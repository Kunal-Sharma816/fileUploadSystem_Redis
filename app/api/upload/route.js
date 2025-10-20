import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Dataset from "@/app/models/Dataset";

// Helper function to parse CSV
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => 
    line.split(',').map(cell => cell.trim())
  );
  
  return {
    headers,
    rows: rows.slice(0, 10), // First 10 rows for preview
    totalRows: rows.length,
    totalColumns: headers.length
  };
}

// Helper function to parse JSON
function parseJSON(text) {
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
}

export async function POST(request) {
  try {
    await connectDB();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileText = buffer.toString('utf-8');

    // Parse based on file type
    let preview;
    
    try {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        preview = parseCSV(fileText);
      } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
        preview = parseJSON(fileText);
      } else {
        // Default fallback
        preview = {
          headers: ["Data"],
          rows: [["File content preview not available"]],
          totalRows: 0,
          totalColumns: 1
        };
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
      preview = {
        headers: ["Error"],
        rows: [["Failed to parse file"]],
        totalRows: 0,
        totalColumns: 1
      };
    }

    // Save dataset into DB
    const dataset = await Dataset.create({
      filename: file.name,
      originalName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      data: buffer.toString("base64"),
      preview: preview,
    });

    console.log("Dataset saved:", dataset._id);

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      id: dataset._id.toString(),
      previewUrl: `/preview/${dataset._id.toString()}`
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: "Upload failed", 
      details: error.message 
    }, { status: 500 });
  }
}