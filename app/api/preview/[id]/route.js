import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Dataset from '@/app/models/Dataset'; // ✅ FIXED: Correct path
import { redisHelpers } from '@/lib/redis';  // ✅ FIXED: Correct import

export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    
    const dataset = await Dataset.findById(id);
    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found or expired' },
        { status: 404 }
      );
    }

    // Check if expired
    if (dataset.status === 'expired' || (dataset.expiresAt && new Date() > dataset.expiresAt)) {
      return NextResponse.json(
        { error: 'Dataset has expired' },
        { status: 410 }
      );
    }

    // Try to get preview from Redis first (faster)
    let previewData = null;
    if (dataset.redisUploadId) {  // ✅ FIXED: correct property name
      try {
        previewData = await redisHelpers.getDatasetPreview(dataset.redisUploadId);  // ✅ FIXED
        console.log('📦 Loaded preview from Redis cache');
      } catch (redisError) {
        console.warn('⚠️  Redis fetch failed, using MongoDB data:', redisError.message);
      }
    }

    // If not in Redis, use MongoDB data
    if (!previewData) {
      console.log('💾 Loading preview from MongoDB');
      if (dataset.fileType === 'image') {
        previewData = {
          type: 'image',
          ...dataset.imageData
        };
      } else {
        previewData = dataset.preview;
      }
    }

    return NextResponse.json({
      success: true,
      dataset: {
        id: dataset._id,
        filename: dataset.originalName,
        fileSize: dataset.fileSize,
        fileType: dataset.fileType,
        preview: previewData,
        status: dataset.status,
        uploadedAt: dataset.uploadedAt,
        expiresAt: dataset.expiresAt,
        timeRemaining: dataset.expiresAt ? Math.max(0, dataset.expiresAt - new Date()) : null,
        batchInfo: dataset.batchInfo
      }
    });

  } catch (error) {
    console.error('❌ Preview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dataset preview', details: error.message },
      { status: 500 }
    );
  }
}