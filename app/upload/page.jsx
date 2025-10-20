"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, FileText, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const router = useRouter();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (1GB max)
      if (selectedFile.size > 1024 * 1024 * 1024) {
        setError("File size exceeds 1GB limit");
        return;
      }

      setFile(selectedFile);
      setError("");
      setSuccess(null);
      setUploadProgress(0);
    }
  };

  const uploadFileInChunks = async (file) => {
    try {
      // Step 1: Initialize upload
      setUploadStatus("Initializing upload...");
      const initResponse = await fetch("/api/upload-chunk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        throw new Error(error.error || "Failed to initialize upload");
      }

      const { uploadId, chunkSize, totalChunks } = await initResponse.json();

      // Step 2: Upload chunks
      let uploadedChunks = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("chunkIndex", chunkIndex);
        formData.append("totalChunks", totalChunks);
        formData.append("uploadId", uploadId);
        formData.append("filename", file.name);
        formData.append("fileSize", file.size);
        formData.append("mimeType", file.type);

        setUploadStatus(`Uploading chunk ${chunkIndex + 1} of ${totalChunks}...`);

        const chunkResponse = await fetch("/api/upload-chunk", {
          method: "POST",
          body: formData,
        });

        if (!chunkResponse.ok) {
          const error = await chunkResponse.json();
          throw new Error(error.error || `Failed to upload chunk ${chunkIndex + 1}`);
        }

        const chunkData = await chunkResponse.json();
        uploadedChunks++;
        
        const progress = Math.round((uploadedChunks / totalChunks) * 100);
        setUploadProgress(progress);

        // Check if upload is complete
        if (chunkData.isComplete) {
          setUploadStatus("Processing file...");
          return chunkData;
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const result = await uploadFileInChunks(file);

      if (result.isComplete) {
        setSuccess({
          message: "File uploaded and processed successfully!",
          previewUrl: result.previewUrl
        });

        // Redirect to preview page after 2 seconds
        setTimeout(() => {
          router.push(result.previewUrl);
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
      setUploadStatus("");
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-8 h-8 text-gray-400" />;
    
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />;
    }
    return <FileText className="w-8 h-8 text-green-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Upload Dataset or Image</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Choose a file to upload</CardTitle>
          <p className="text-sm text-muted-foreground">
            Supports CSV, JSON, Excel, and Images up to 1GB
          </p>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleUpload}>
            {/* File Input with Drag & Drop Style */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <div className="flex flex-col items-center gap-4">
                {getFileIcon()}
                
                <Input
                  type="file"
                  accept=".csv,.json,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                  onChange={handleFileChange}
                  className="max-w-xs"
                  disabled={uploading}
                />
              </div>
            </div>

            {/* File Info */}
            {file && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm font-medium text-blue-900">
                  📁 {file.name}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Size: {formatFileSize(file.size)} • Type: {file.type || 'Unknown'}
                </p>
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{uploadStatus}</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Upload Button */}
            <Button 
              type="submit" 
              disabled={!file || uploading}
              className="w-full"
              size="lg"
            >
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? uploadStatus : "Upload File"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert className="mt-4 bg-green-50 border-green-200 text-green-700">
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            {success.message}
            <p className="text-sm mt-1">Redirecting to preview...</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Supported Formats Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Supported Formats & Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">📊 Datasets</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>CSV (.csv)</li>
                <li>JSON (.json)</li>
                <li>Excel (.xlsx, .xls)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">🖼️ Images</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>JPEG, PNG, GIF</li>
                <li>WebP, BMP</li>
                <li>Auto-compressed previews</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-900">
              <strong>✨ Features:</strong>
            </p>
            <ul className="text-xs text-blue-800 mt-1 space-y-1">
              <li>• Chunked upload for large files (up to 1GB)</li>
              <li>• Redis-powered fast preview generation</li>
              <li>• Real-time upload progress tracking</li>
              <li>• Automatic image compression and thumbnails</li>
              <li>• 24-hour expiration (unless finalized)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}