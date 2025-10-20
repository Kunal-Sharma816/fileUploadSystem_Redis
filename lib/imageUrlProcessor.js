import sharp from 'sharp';
import { redisHelpers } from './redis';

// Detect if a string is an image URL
export function isImageUrl(str) {
  if (!str || typeof str !== 'string') return false;
  
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
  const urlPattern = /^(https?:\/\/)/i;
  
  // Check if it's a URL and ends with image extension
  return urlPattern.test(str) && imageExtensions.test(str);
}

// Detect image columns in dataset headers and rows
export function detectImageColumns(headers, rows) {
  const imageColumns = [];
  
  headers.forEach((header, index) => {
    // Check if column name suggests images
    const headerLower = header.toLowerCase();
    const isImageColumn = 
      headerLower.includes('image') || 
      headerLower.includes('img') || 
      headerLower.includes('photo') || 
      headerLower.includes('picture') ||
      headerLower.includes('url');
    
    // Check if first few rows contain image URLs
    let urlCount = 0;
    const sampleSize = Math.min(5, rows.length);
    
    for (let i = 0; i < sampleSize; i++) {
      if (rows[i] && rows[i][index] && isImageUrl(rows[i][index])) {
        urlCount++;
      }
    }
    
    // If more than 60% of samples are image URLs, mark as image column
    if (urlCount / sampleSize > 0.6 || isImageColumn) {
      imageColumns.push({
        index,
        name: header,
        confidence: urlCount / sampleSize
      });
    }
  });
  
  return imageColumns;
}

// Download and process image from URL
export async function downloadAndProcessImage(imageUrl, uploadId) {
  try {
    // Check if already cached in Redis
    const cached = await redisHelpers.getImagePreview(`${uploadId}:${imageUrl}`);
    if (cached) {
      return {
        thumbnail: cached.toString('base64'),
        cached: true
      };
    }

    // Download image with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Dataset Preview Bot)'
      }
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process image - create thumbnail
    const thumbnail = await sharp(buffer)
      .resize(100, 100, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Cache in Redis for 30 minutes
    await redisHelpers.storeImagePreview(`${uploadId}:${imageUrl}`, thumbnail, 1800);

    return {
      thumbnail: thumbnail.toString('base64'),
      cached: false
    };

  } catch (error) {
    console.error(`Failed to process image from ${imageUrl}:`, error.message);
    return {
      thumbnail: null,
      error: error.message
    };
  }
}

// Process all images in dataset preview
export async function processDatasetImages(headers, rows, uploadId) {
  const imageColumns = detectImageColumns(headers, rows);
  
  if (imageColumns.length === 0) {
    return {
      hasImages: false,
      imageColumns: [],
      processedRows: rows
    };
  }

  console.log(`Found ${imageColumns.length} image columns:`, imageColumns.map(col => col.name));

  // Process images in parallel (limit concurrency)
  const processedRows = await Promise.all(
    rows.map(async (row, rowIndex) => {
      const newRow = [...row];
      
      // Process each image column in this row
      for (const imgCol of imageColumns) {
        const imageUrl = row[imgCol.index];
        
        if (imageUrl && isImageUrl(imageUrl)) {
          const result = await downloadAndProcessImage(imageUrl, uploadId);
          
          // Store both URL and thumbnail data
          newRow[imgCol.index] = {
            type: 'image',
            url: imageUrl,
            thumbnail: result.thumbnail,
            error: result.error
          };
        }
      }
      
      return newRow;
    })
  );

  return {
    hasImages: true,
    imageColumns: imageColumns.map(col => ({
      index: col.index,
      name: col.name
    })),
    processedRows
  };
}

// Batch process images (for large datasets)
export async function batchProcessImages(imageUrls, uploadId, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(url => downloadAndProcessImage(url, uploadId))
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to avoid overwhelming the server
    if (i + batchSize < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}