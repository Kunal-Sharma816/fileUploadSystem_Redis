import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { processDatasetImages } from './imageUrlProcessor';

// CSV Parser with image URL detection
export async function parseCSV(buffer, uploadId = null) {
  const text = buffer.toString('utf-8');
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data.slice(0, 10).map(row => 
          headers.map(h => String(row[h] || ''))
        );
        
        // Process images if uploadId is provided
        let imageInfo = { hasImages: false, imageColumns: [], processedRows: rows };
        if (uploadId) {
          imageInfo = await processDatasetImages(headers, rows, uploadId);
        }
        
        resolve({
          headers,
          rows: imageInfo.processedRows,
          totalRows: results.data.length,
          totalColumns: headers.length,
          errors: results.errors,
          hasImages: imageInfo.hasImages,
          imageColumns: imageInfo.imageColumns
        });
      },
      error: (error) => reject(error)
    });
  });
}

// Excel Parser with image URL detection
export async function parseExcel(buffer, uploadId = null) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    // Get first worksheet
    const worksheet = workbook.worksheets[0];
    
    if (!worksheet || worksheet.rowCount === 0) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        totalColumns: 0,
        hasImages: false,
        imageColumns: []
      };
    }
    
    const rows = [];
    let headers = [];
    
    // Extract headers from first row
    const firstRow = worksheet.getRow(1);
    headers = firstRow.values.slice(1).map(cell => String(cell || ''));
    
    // Extract data rows (max 10 for preview)
    const maxRows = Math.min(11, worksheet.rowCount);
    
    for (let i = 2; i <= maxRows; i++) {
      const row = worksheet.getRow(i);
      const rowData = row.values.slice(1).map(cell => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'object' && cell.text) return String(cell.text);
        if (typeof cell === 'object' && cell.result) return String(cell.result);
        return String(cell);
      });
      rows.push(rowData);
    }
    
    // Process images if uploadId is provided
    let imageInfo = { hasImages: false, imageColumns: [], processedRows: rows };
    if (uploadId) {
      imageInfo = await processDatasetImages(headers, rows, uploadId);
    }
    
    return {
      headers,
      rows: imageInfo.processedRows,
      totalRows: worksheet.rowCount - 1,
      totalColumns: headers.length,
      hasImages: imageInfo.hasImages,
      imageColumns: imageInfo.imageColumns
    };
  } catch (error) {
    throw new Error(`Excel parsing failed: ${error.message}`);
  }
}

// JSON Parser
export async function parseJSON(buffer) {
  try {
    const text = buffer.toString('utf-8');
    const data = JSON.parse(text);
    
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.slice(0, 10).map(obj => 
        headers.map(h => String(obj[h] || ''))
      );
      
      return {
        headers,
        rows,
        totalRows: data.length,
        totalColumns: headers.length
      };
    }
    
    return {
      headers: ['Data'],
      rows: [[JSON.stringify(data)]],
      totalRows: 1,
      totalColumns: 1
    };
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

// Image Processor
export async function processImage(buffer, mimeType) {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Create thumbnail (200x200)
    const thumbnail = await image
      .resize(200, 200, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    // Create compressed preview (800px max width)
    const compressed = await sharp(buffer)
      .resize(800, 800, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    return {
      thumbnail: thumbnail.toString('base64'),
      compressed: compressed.toString('base64'),
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      format: metadata.format,
      size: buffer.length
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

// File type detector
export function detectFileType(filename, mimeType) {
  const ext = filename.toLowerCase().split('.').pop();
  
  // Image types
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext) || 
      mimeType.startsWith('image/')) {
    return 'image';
  }
  
  // Dataset types
  if (['csv', 'json', 'xlsx', 'xls'].includes(ext) ||
      ['text/csv', 'application/json', 'application/vnd.ms-excel', 
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(mimeType)) {
    return 'dataset';
  }
  
  return 'document';
}

// Process file based on type
export async function processFile(buffer, filename, mimeType) {
  const fileType = detectFileType(filename, mimeType);
  
  if (fileType === 'image') {
    return {
      type: 'image',
      data: await processImage(buffer, mimeType)
    };
  }
  
  // Dataset processing
  const ext = filename.toLowerCase().split('.').pop();
  let preview;
  
  if (ext === 'csv' || mimeType === 'text/csv') {
    preview = await parseCSV(buffer);
  } else if (ext === 'json' || mimeType === 'application/json') {
    preview = await parseJSON(buffer);
  } else if (['xlsx', 'xls'].includes(ext)) {
    preview = await parseExcel(buffer);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
  
  return {
    type: 'dataset',
    data: preview
  };
}