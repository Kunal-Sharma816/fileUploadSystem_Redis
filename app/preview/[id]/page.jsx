"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { 
  Loader2, 
  CheckCircle2, 
  Image as ImageIcon, 
  Database,
  ExternalLink,
  ZoomIn
} from "lucide-react";

export default function PreviewPage() {
  const params = useParams();
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchDataset();
  }, [params.id]);

  const fetchDataset = async () => {
    try {
      const response = await fetch(`/api/preview/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load dataset");
      }

      setDataset(data.dataset);
      setFinalized(data.dataset.status === "finalized");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const response = await fetch(`/api/finalize/${params.id}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to finalize dataset");
      }

      setFinalized(true);
      fetchDataset();
    } catch (err) {
      setError(err.message);
    } finally {
      setFinalizing(false);
    }
  };

  const formatTimeRemaining = (ms) => {
    if (!ms) return "N/A";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Render cell content (handles both text and images)
  const renderCell = (cell, columnIndex) => {
    // Check if this cell contains image data
    if (cell && typeof cell === 'object' && cell.type === 'image') {
      if (cell.error) {
        return (
          <div className="flex items-center gap-2 text-red-600 text-xs">
            <ImageIcon className="w-4 h-4" />
            <span>Failed to load</span>
          </div>
        );
      }

      if (cell.thumbnail) {
        return (
          <div className="flex items-center gap-2">
            <div 
              className="relative group cursor-pointer"
              onClick={() => setSelectedImage(cell)}
            >
              <img
                src={`data:image/jpeg;base64,${cell.thumbnail}`}
                alt="Preview"
                className="w-16 h-16 object-cover rounded border border-gray-300 hover:border-blue-500 transition-colors"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded flex items-center justify-center">
                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <a 
              href={cell.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View original
            </a>
          </div>
        );
      }
    }

    // Regular text cell
    return cell || "-";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Loading preview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isImage = dataset.fileType === 'image';
  const hasImageUrls = dataset.preview?.hasImages;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Dataset Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isImage ? (
                <ImageIcon className="w-5 h-5 text-blue-500" />
              ) : (
                <Database className="w-5 h-5 text-green-500" />
              )}
              <CardTitle>
                {isImage ? 'Image Preview' : 'Dataset Preview'}
              </CardTitle>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                <strong>File:</strong> {dataset.filename}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Size:</strong> {formatFileSize(dataset.fileSize)}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Type:</strong> {dataset.fileType}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Uploaded:</strong>{" "}
                {new Date(dataset.uploadedAt).toLocaleString()}
              </p>
              
              {dataset.batchInfo && dataset.batchInfo.isComplete && (
                <p className="text-sm text-blue-600 font-medium">
                  ⚡ Uploaded in {dataset.batchInfo.totalBatches} chunks
                </p>
              )}
              
              {!finalized && dataset.timeRemaining && (
                <p className="text-sm text-red-600 font-medium">
                  ⏰ Expires in: {formatTimeRemaining(dataset.timeRemaining)}
                </p>
              )}
            </div>
          </div>

          <div>
            {finalized ? (
              <div className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md font-medium">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalized
              </div>
            ) : (
              <Button
                onClick={handleFinalize}
                disabled={finalizing}
                className="bg-green-600 hover:bg-green-700"
              >
                {finalizing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {finalizing ? "Finalizing..." : "Finalize"}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Image Preview */}
      {isImage && dataset.preview && (
        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Dimensions: {dataset.preview.dimensions?.width} x {dataset.preview.dimensions?.height}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Compressed Preview */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Full Preview</h3>
                <div className="border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center p-4">
                  <img
                    src={`data:image/jpeg;base64,${dataset.preview.compressed}`}
                    alt="Preview"
                    className="max-w-full h-auto max-h-96 object-contain"
                  />
                </div>
              </div>

              {/* Thumbnail */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Thumbnail</h3>
                <div className="border rounded-lg overflow-hidden bg-gray-50 inline-block p-2">
                  <img
                    src={`data:image/jpeg;base64,${dataset.preview.thumbnail}`}
                    alt="Thumbnail"
                    className="w-48 h-48 object-contain"
                  />
                </div>
              </div>

              {/* Image Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <strong>Image Details:</strong>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <p>Format: {dataset.preview.format?.toUpperCase()}</p>
                  <p>Size: {formatFileSize(dataset.preview.size || dataset.fileSize)}</p>
                  <p>Width: {dataset.preview.dimensions?.width}px</p>
                  <p>Height: {dataset.preview.dimensions?.height}px</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dataset Preview */}
      {!isImage && dataset.preview && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Showing first {dataset.preview.rows?.length || 0} of{" "}
              {dataset.preview.totalRows} rows
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {dataset.preview.headers?.map((header, idx) => (
                      <TableHead key={idx}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.preview.rows?.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <TableCell key={cellIdx}>
                          {cell || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <strong>Dataset Statistics:</strong>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <p>Total Rows: {dataset.preview.totalRows}</p>
                <p>Total Columns: {dataset.preview.totalColumns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}