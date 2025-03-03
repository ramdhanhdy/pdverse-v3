"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  Download, Printer, Maximize, Search, List, Wand2,
  Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getDocumentFromPythonBackend } from "@/lib/python-backend";

type FileDetails = {
  id: string;
  filename: string;
  original_filename: string;
  size: number;
  path: string;
  mimetype: string;
  created_at: number;
  updated_at: number;
};

type PdfMetadata = {
  file_id: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  page_count?: number;
  creation_date?: string;
  modification_date?: string;
  summary?: string;
  document_type?: string;
  topics?: string;
  ai_enhanced?: boolean;
  needs_review?: boolean;
  created_at: number;
  updated_at: number;
};

const FileMetadataSection = ({ metadata }: { metadata: any }) => {
  if (!metadata) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Document Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{metadata.summary || "No summary available"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-medium">Document Type:</span>
            <span className="ml-2">{metadata.doc_type || "Unclassified"}</span>
          </div>
          <div>
            <span className="font-medium">Key Topics:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {(metadata.topics || []).map((topic: string) => (
                <Badge key={topic} variant="outline">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add other metadata sections as needed */}
    </div>
  );
};

export default function FileViewPage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<FileDetails | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showOutline, setShowOutline] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!params.id) return;
      
      try {
        setIsLoading(true);
        
        // Use Python backend to get document details
        try {
          const documentData = await getDocumentFromPythonBackend(params.id as string);
          
          // Convert Python backend format to our frontend format
          const fileData: FileDetails = {
            id: documentData.id,
            filename: documentData.filename,
            original_filename: documentData.title,
            size: documentData.file_size,
            path: '', // Not provided by Python backend
            mimetype: 'application/pdf',
            created_at: new Date(documentData.creation_date || Date.now()).getTime() / 1000,
            updated_at: new Date(documentData.modification_date || Date.now()).getTime() / 1000,
          };
          
          setFile(fileData);
          
          // Set metadata from Python backend
          const metadataData: PdfMetadata = {
            file_id: documentData.id,
            title: documentData.title,
            author: documentData.author,
            summary: documentData.summary,
            page_count: documentData.page_count,
            creation_date: documentData.creation_date || undefined,
            modification_date: documentData.modification_date || undefined,
            document_type: documentData.doc_type,
            topics: documentData.topics || [],
            ai_enhanced: true,
            needs_review: false,
            created_at: new Date(documentData.creation_date || Date.now()).getTime() / 1000,
            updated_at: new Date(documentData.modification_date || Date.now()).getTime() / 1000,
          };
          
          setMetadata(metadataData);
          
        } catch (error) {
          console.error("Error fetching document from Python backend:", error);
          
          // Fall back to the original method if Python backend fails
          const response = await fetch(`/api/files?id=${params.id}`);
          
          if (!response.ok) {
            throw new Error("Failed to fetch file details");
          }
          
          const data = await response.json();
          // Handle both response formats: { file: ... } or direct file object
          const fileData = data.file || data;
          setFile(fileData);
          
          // Fetch PDF metadata if available
          if (fileData && fileData.id) {
            try {
              const metadataResponse = await fetch(`/api/pdf-metadata?fileId=${fileData.id}`);
              if (metadataResponse.ok) {
                const metadataData = await metadataResponse.json();
                setMetadata(metadataData.metadata);
              }
            } catch (metadataError) {
              console.error("Error fetching PDF metadata:", metadataError);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching file details:", error);
        toast.error("Failed to load file details. Please try again.");
        router.push("/dashboard/files");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileDetails();
  }, [params.id, router]);

  useEffect(() => {
    if (file) {
      console.log("PDF Viewer - file object:", file);
      console.log("PDF Viewer - trying to load file from path:", file.path);
      
      // Calculate and log the absolute URL
      const absoluteUrl = window.location.origin + file.path;
      console.log("PDF Viewer - absolute URL:", absoluteUrl);
      
      // Try to fetch the file directly to check if it's accessible
      fetch(file.path)
        .then(response => {
          console.log("PDF fetch response status:", response.status);
          return response.blob();
        })
        .then(blob => {
          console.log("PDF fetch success, content type:", blob.type);
        })
        .catch(error => {
          console.error("PDF fetch failed:", error);
        });
    }
  }, [file]);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => prev + 1);
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const toggleFullScreen = () => {
    if (!pdfContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      pdfContainerRef.current.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };
  
  const handlePrint = () => {
    if (!file) return;
    
    const printWindow = window.open(file.path, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };
  
  const handleDownload = () => {
    if (!file) return;
    
    // Create a download link pointing directly to our API route
    const link = document.createElement('a');
    link.href = file.path;
    link.download = file.original_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteFile = async () => {
    if (!file || !window.confirm("Are you sure you want to delete this file? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/files?id=${file.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete file');
      
      toast.success("File deleted successfully");
      router.push("/dashboard/files");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file. Please try again.");
      setIsDeleting(false);
    }
  };

  const enhanceMetadata = async () => {
    if (!file) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhance-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId: file.id }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to enhance metadata');
      }
      
      const data = await response.json();
      setMetadata(data.metadata);
      toast.success('Metadata enhanced successfully');
    } catch (error) {
      console.error('Error enhancing metadata:', error);
      toast.error('Failed to enhance metadata. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
        <h3 className="text-xl font-semibold">File not found</h3>
        <p className="text-muted-foreground">
          The file you are looking for does not exist or has been deleted.
        </p>
        <Button onClick={() => router.push("/dashboard/files")}>
          Back to Files
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {file.original_filename}
          </h1>
          <div className="text-sm text-muted-foreground">
            {formatBytes(file.size)} • 
            {new Date(file.updated_at * 1000).toLocaleDateString()}
          </div>
          {metadata?.author && (
            <Badge variant="outline" className="mr-2">
              Author: {metadata.author}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/files")}>
            Back
          </Button>
          <Button variant="destructive" onClick={handleDeleteFile} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
        <div className="flex flex-col">
          <Card className="p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrevPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous page</span>
                </Button>
                <span className="text-sm">
                  Page {pageNumber}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextPage}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next page</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={zoomOut}>
                  <ZoomOut className="h-4 w-4" />
                  <span className="sr-only">Zoom out</span>
                </Button>
                <span className="text-sm">{Math.round(scale * 100)}%</span>
                <Button variant="outline" size="icon" onClick={zoomIn}>
                  <ZoomIn className="h-4 w-4" />
                  <span className="sr-only">Zoom in</span>
                </Button>
                <Button variant="outline" size="icon" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Download</span>
                </Button>
                <Button variant="outline" size="icon" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  <span className="sr-only">Print</span>
                </Button>
                <Button variant="outline" size="icon" onClick={toggleFullScreen}>
                  <Maximize className="h-4 w-4" />
                  <span className="sr-only">Full Screen</span>
                </Button>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search in document..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="max-w-sm"
                />
                <Button variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div 
              ref={pdfContainerRef}
              className={`flex-1 overflow-auto flex justify-center bg-accent/30 rounded-md ${isFullScreen ? 'fullscreen-pdf' : ''}`}
            >
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">File Information</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Filename</h3>
                <p className="text-sm text-muted-foreground break-all">
                  {file.original_filename}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Size</h3>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Uploaded</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(file.created_at * 1000).toLocaleString()}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Last Modified</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(file.updated_at * 1000).toLocaleString()}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">MIME Type</h3>
                <p className="text-sm text-muted-foreground">
                  {file.mimetype}
                </p>
              </div>
            </div>
          </Card>

          {metadata && (
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">PDF Metadata</h2>
              </div>
              <FileMetadataSection metadata={metadata} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
