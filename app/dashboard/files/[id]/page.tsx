"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { Document, Page, pdfjs, Outline } from "react-pdf";
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { toast } from "sonner";
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  Download, Printer, Maximize, Search, List
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// Set up the worker for PDF.js outside of component to avoid ESM issues
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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

export default function FileViewPage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<FileDetails | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showOutline, setShowOutline] = useState(false);
  const [outline, setOutline] = useState<any[]>([]);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Initialize the PDF.js worker on the client side
  useEffect(() => {
    // Set worker directly without dynamic import
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  }, []);

  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!params.id) return;
      
      try {
        setIsLoading(true);
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
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

  const handleOutlineItemClick = (item: any) => {
    if (item.dest) {
      // If the item has a destination, navigate to that page
      // This is a simplified approach; in a real app you might want to
      // handle more complex destinations
      if (typeof item.dest === 'string') {
        // For named destinations, you'd need to resolve them first
        console.log("Named destination:", item.dest);
      } else if (Array.isArray(item.dest)) {
        const pageNumber = item.dest[0] + 1; // PDF pages are 0-indexed
        setPageNumber(pageNumber);
      }
    }
  };

  const onItemClick = ({ pageNumber }: { pageNumber: number }) => {
    setPageNumber(pageNumber);
  };

  const deleteFile = async () => {
    if (!file) return;
    
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/files?id=${file.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete file");
      }
      
      toast.success("File deleted successfully");
      router.push("/dashboard/files");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file. Please try again.");
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
            {metadata?.page_count && ` • ${metadata.page_count} pages`}
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
          <Button variant="destructive" onClick={deleteFile}>
            Delete
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
                  disabled={pageNumber <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous page</span>
                </Button>
                <span className="text-sm">
                  Page {pageNumber} of {numPages || "?"}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextPage}
                  disabled={pageNumber >= (numPages || 1)}
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
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setShowOutline(!showOutline)}
                >
                  <List className="h-4 w-4" />
                  <span className="sr-only">Toggle Outline</span>
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
              className={`flex-1 overflow-auto flex ${showOutline ? 'justify-start' : 'justify-center'} bg-accent/30 rounded-md ${isFullScreen ? 'fullscreen-pdf' : ''}`}
            >
              {showOutline && (
                <div className="w-64 bg-background p-4 overflow-auto border-r">
                  <h3 className="font-medium mb-2">Document Outline</h3>
                  <Document file={file.path}>
                    <Outline onItemClick={onItemClick} />
                  </Document>
                </div>
              )}
              <div className="flex-1 flex justify-center">
                <Document
                  file={file.path}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-12 w-12 text-destructive"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" x2="12" y1="8" y2="12" />
                        <line x1="12" x2="12.01" y1="16" y2="16" />
                      </svg>
                      <h3 className="text-xl font-semibold">Error loading PDF</h3>
                      <p className="text-muted-foreground text-center">
                        There was an error loading this PDF file. It may be corrupted or unsupported.
                      </p>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </div>
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
              <h2 className="text-xl font-semibold mb-4">PDF Metadata</h2>
              <div className="space-y-4">
                {metadata.title && (
                  <div>
                    <h3 className="text-sm font-medium">Title</h3>
                    <p className="text-sm text-muted-foreground break-all">
                      {metadata.title}
                    </p>
                  </div>
                )}
                {metadata.author && (
                  <div>
                    <h3 className="text-sm font-medium">Author</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.author}
                    </p>
                  </div>
                )}
                {metadata.subject && (
                  <div>
                    <h3 className="text-sm font-medium">Subject</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.subject}
                    </p>
                  </div>
                )}
                {metadata.keywords && (
                  <div>
                    <h3 className="text-sm font-medium">Keywords</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.keywords}
                    </p>
                  </div>
                )}
                {metadata.creator && (
                  <div>
                    <h3 className="text-sm font-medium">Creator</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.creator}
                    </p>
                  </div>
                )}
                {metadata.producer && (
                  <div>
                    <h3 className="text-sm font-medium">Producer</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.producer}
                    </p>
                  </div>
                )}
                {metadata.page_count && (
                  <div>
                    <h3 className="text-sm font-medium">Pages</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.page_count}
                    </p>
                  </div>
                )}
                {metadata.creation_date && (
                  <div>
                    <h3 className="text-sm font-medium">Creation Date</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(metadata.creation_date).toLocaleString()}
                    </p>
                  </div>
                )}
                {metadata.modification_date && (
                  <div>
                    <h3 className="text-sm font-medium">Modification Date</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(metadata.modification_date).toLocaleString()}
                    </p>
                  </div>
                )}
                {metadata.summary && (
                  <div>
                    <h3 className="text-sm font-medium">Summary</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.summary}
                    </p>
                  </div>
                )}
                {metadata.document_type && (
                  <div>
                    <h3 className="text-sm font-medium">Document Type</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.document_type}
                    </p>
                  </div>
                )}
                {metadata.topics && (
                  <div>
                    <h3 className="text-sm font-medium">Topics</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.topics}
                    </p>
                  </div>
                )}
                {metadata.ai_enhanced && (
                  <div>
                    <h3 className="text-sm font-medium">AI Enhanced</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.ai_enhanced ? 'Yes' : 'No'}
                    </p>
                  </div>
                )}
                {metadata.needs_review && (
                  <div>
                    <h3 className="text-sm font-medium">Needs Review</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.needs_review ? 'Yes' : 'No'}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
