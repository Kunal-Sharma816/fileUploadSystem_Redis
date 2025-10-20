import { NextResponse } from "next/server";
import { redisHelpers } from "@/lib/redis";
import connectDB from "@/lib/mongodb";
import Dataset from "@/app/models/Dataset";
import { processFile } from "@/lib/fileProcessors";
import { randomUUID } from 'crypto'; // ✅ Use Node.js built-in instead of uuid package

// Increase body size limit for large uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Chunk size limit
    },
  },
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    const chunk = formData.get("chunk");
    const chunkIndex = parseInt(formData.get("chunkIndex"));
    const totalChunks = parseInt(formData.get("totalChunks"));
    const uploadId = formData.get("uploadId");
    const filename = formData.get("filename");
    const fileSize = parseInt(formData.get("fileSize"));
    const mimeType = formData.get("mimeType");

    if (!chunk || chunkIndex === undefined || !totalChunks || !uploadId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Convert chunk to buffer
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    
    // Store chunk in Redis (30 minutes expiry)
    await redisHelpers.storeFileChunk(uploadId, chunkIndex, chunkBuffer.toString('base64'), 1800);

    // Update metadata
    let metadata = await redisHelpers.getUploadMetadata(uploadId);
    if (!metadata) {
      metadata = {
        filename,
        fileSize,
        mimeType,
        totalChunks,
        uploadedChunks: [],
        createdAt: new Date().toISOString()
      };
    }
    
    metadata.uploadedChunks.push(chunkIndex);
    metadata.uploadedChunks = [...new Set(metadata.uploadedChunks)]; // Remove duplicates
    
    await redisHelpers.storeUploadMetadata(uploadId, metadata, 1800);

    // Update progress
    const progress = {
      uploadedChunks: metadata.uploadedChunks.length,
      totalChunks,
      percentage: Math.round((metadata.uploadedChunks.length / totalChunks) * 100)
    };
    
    await redisHelpers.setUploadProgress(uploadId, progress);

    // Check if all chunks are uploaded
    const isComplete = metadata.uploadedChunks.length === totalChunks;

    if (isComplete) {
      // Reassemble file from chunks
      const chunks = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkData = await redisHelpers.getFileChunk(uploadId, i);
        if (!chunkData) {
          return NextResponse.json(
            { error: `Missing chunk ${i}` },
            { status: 400 }
          );
        }
        chunks.push(Buffer.from(chunkData, 'base64'));
      }
      
      const completeFile = Buffer.concat(chunks);
      
      // Process the file (parse or process image)
      let processedData;
      try {
        // Pass uploadId to enable image URL processing
        processedData = await processFile(completeFile, filename, mimeType, uploadId);
      } catch (error) {
        return NextResponse.json(
          { error: `File processing failed: ${error.message}` },
          { status: 500 }
        );
      }

      // Store preview in Redis for fast retrieval
      if (processedData.type === 'image') {
        await redisHelpers.storeImagePreview(uploadId, processedData.data.compressed);
        await redisHelpers.storeDatasetPreview(uploadId, {
          type: 'image',
          ...processedData.data
        });
      } else {
        await redisHelpers.storeDatasetPreview(uploadId, processedData.data);
      }

      // Save to MongoDB
      await connectDB();
      
      const datasetData = {
        filename,
        originalName: filename,
        fileSize,
        mimeType,
        fileType: processedData.type,
        redisUploadId: uploadId,
        status: 'pending',
        batchInfo: {
          totalBatches: totalChunks,
          uploadedBatches: totalChunks,
          batchSize: Math.ceil(fileSize / totalChunks),
          isComplete: true
        }
      };

      // Add type-specific data
      if (processedData.type === 'image') {
        datasetData.imageData = processedData.data;
      } else {
        datasetData.data = completeFile.toString('base64');
        datasetData.preview = processedData.data;
      }

      const dataset = await Dataset.create(datasetData);

      // Clean up chunks from Redis (keep preview for 30 mins)
      for (let i = 0; i < totalChunks; i++) {
        const key = `upload:${uploadId}:chunk:${i}`;
        await redisHelpers.cleanupUpload(uploadId);
      }

      return NextResponse.json({
        success: true,
        message: "Upload complete",
        isComplete: true,
        uploadId,
        datasetId: dataset._id.toString(),
        previewUrl: `/preview/${dataset._id.toString()}`,
        progress
      });
    }

    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
      isComplete: false,
      uploadId,
      progress
    });

  } catch (error) {
    console.error("Chunk upload error:", error);
    return NextResponse.json(
      { error: "Chunk upload failed", details: error.message },
      { status: 500 }
    );
  }
}

// Initialize upload
export async function PUT(request) {
  try {
    const { filename, fileSize, mimeType } = await request.json();
    
    if (!filename || !fileSize) {
      return NextResponse.json(
        { error: "Missing filename or fileSize" },
        { status: 400 }
      );
    }

    // Check file size limit (1GB)
    if (fileSize > 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 1GB limit" },
        { status: 413 }
      );
    }

    const uploadId = randomUUID(); // ✅ Use randomUUID instead of uuidv4
    
    // Calculate optimal chunk size (5MB for files > 50MB, else 2MB)
    const chunkSize = fileSize > 50 * 1024 * 1024 ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    const metadata = {
      uploadId,
      filename,
      fileSize,
      mimeType,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      createdAt: new Date().toISOString()
    };

    await redisHelpers.storeUploadMetadata(uploadId, metadata, 1800);

    return NextResponse.json({
      success: true,
      uploadId,
      chunkSize,
      totalChunks
    });

  } catch (error) {
    console.error("Upload initialization error:", error);
    return NextResponse.json(
      { error: "Failed to initialize upload" },
      { status: 500 }
    );
  }
}