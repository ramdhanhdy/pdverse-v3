import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  Download, Printer, Maximize, Search, List, Wand2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type FileDetails = {
  id: string;
  filename: string;
  path: string;
  type: string;
  size: number;
  created_at: number;
  updated_at: number;
}

type PdfMetadata = {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  page_count?: number;
  creation_date?: string;
  modification_date?: string;
}

export default function FileViewPage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<FileDetails | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Function to handle messages from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'pdfLoaded') {
        setTotalPages(event.data.numPages);
        setIsLoading(false);
      } else if (event.data && event.data.type === 'pdfError') {
        console.error('PDF Error:', event.data.error);
        toast.error(`Error loading PDF: ${event.data.error}`);
        setIsLoading(false);
      }
    };

    // Add event listener for postMessage from iframe
    window.addEventListener('message', handleMessage);

    // Clean up
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Function to generate iframe src URL
  const getIframeSrc = () => {
    if (!file) return '';
    
    // Get the absolute file URL
    const fileUrl = `${window.location.origin}${file.path}`;
    
    // Create URL to the PDF viewer with the file URL as a parameter
    return `/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}`;
  };

  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!params.id) return;
      
      try {
        const response = await fetch(`/api/files/${params.id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Fetched file data:", data);
        setFile(data);
        
        // If it's a PDF, also fetch metadata
        if (data.type === 'application/pdf') {
          try {
            const metadataResponse = await fetch(`/api/files/${params.id}/metadata`);
            if (metadataResponse.ok) {
              const metadataData = await metadataResponse.json();
              setMetadata(metadataData);
            }
          } catch (metadataError) {
            console.error("Failed to fetch PDF metadata:", metadataError);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching file details:", error);
        toast.error("Failed to load file details");
        setIsLoading(false);
      }
    };
    
    fetchFileDetails();
  }, [params.id]);

  useEffect(() => {
    if (file) {
      console.log("File details:", file);
      console.log("File path:", file.path);
      // Generate absolute URL for debugging
      console.log("Absolute URL:", window.location.origin + file.path);
    }
  }, [file]);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
    // Send message to iframe to change page
    iframeRef.current?.contentWindow?.postMessage({
      type: 'changePage',
      pageNumber: pageNumber - 1
    }, '*');
  };

  const goToNextPage = () => {
    if (pageNumber < totalPages) {
      setPageNumber(pageNumber + 1);
      // Send message to iframe to change page
      iframeRef.current?.contentWindow?.postMessage({
        type: 'changePage',
        pageNumber: pageNumber + 1
      }, '*');
    }
  };

  const zoomIn = () => {
    const newScale = scale + 0.2;
    setScale(newScale);
    // Send message to iframe to zoom
    iframeRef.current?.contentWindow?.postMessage({
      type: 'zoom',
      scale: newScale
    }, '*');
  };

  const zoomOut = () => {
    const newScale = Math.max(0.5, scale - 0.2);
    setScale(newScale);
    // Send message to iframe to zoom
    iframeRef.current?.contentWindow?.postMessage({
      type: 'zoom',
      scale: newScale
    }, '*');
  };

  const handleFullScreen = () => {
    if (pdfContainerRef.current) {
      if (!document.fullscreenElement) {
        pdfContainerRef.current.requestFullscreen().catch((err) => {
          toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
        setIsFullScreen(true);
      } else {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Send message to iframe to search
      iframeRef.current?.contentWindow?.postMessage({
        type: 'search',
        query: searchQuery
      }, '*');
    }
  };

  const downloadFile = () => {
    if (!file) return;
    
    const link = document.createElement('a');
    link.href = file.path;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteFile = async () => {
    if (!file) return;
    
    if (!window.confirm(`Are you sure you want to delete ${file.filename}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('File deleted successfully');
        router.push('/dashboard/files');
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  return (
    <div className="container mx-auto py-6 flex flex-col h-[calc(100vh-66px)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/dashboard/files')}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <h1 className="text-2xl font-bold">File Viewer</h1>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={downloadFile}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button 
            variant="destructive" 
            onClick={deleteFile}
          >
            Delete
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : file ? (
        <div className="flex-1">
          <Card className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold truncate">
                {file.filename}
              </h2>
              <div className="text-sm text-muted-foreground">
                {formatBytes(file.size)} • 
                {new Date(file.updated_at * 1000).toLocaleDateString()}
                {totalPages > 0 && ` • ${totalPages} pages`}
              </div>
              {metadata?.author && (
                <Badge variant="outline" className="mr-2">
                  Author: {metadata.author}
                </Badge>
              )}
              {metadata?.title && (
                <Badge variant="outline">
                  Title: {metadata.title}
                </Badge>
              )}
            </div>
            
            {file.type === 'application/pdf' && (
              <div className="px-4 py-2 border-b flex items-center gap-4">
                <div className="flex items-center">
                  <div className="flex items-center space-x-1">
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
                      Page {pageNumber} of {totalPages || "?"}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToNextPage}
                      disabled={pageNumber >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Next page</span>
                    </Button>
                  </div>
                </div>
                
                <Separator orientation="vertical" className="h-6" />
                
                <div className="flex items-center space-x-1">
                  <Button variant="outline" size="icon" onClick={zoomOut}>
                    <ZoomOut className="h-4 w-4" />
                    <span className="sr-only">Zoom out</span>
                  </Button>
                  <Button variant="outline" size="icon" onClick={zoomIn}>
                    <ZoomIn className="h-4 w-4" />
                    <span className="sr-only">Zoom in</span>
                  </Button>
                </div>
                
                <Separator orientation="vertical" className="h-6" />
                
                <div className="flex items-center space-x-1">
                  <Button variant="outline" size="icon" onClick={handleFullScreen}>
                    <Maximize className="h-4 w-4" />
                    <span className="sr-only">Full Screen</span>
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex-1 relative">
              <Input
                placeholder="Search in document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="absolute top-4 right-4 w-64 z-10"
              />
              
              <div 
                ref={pdfContainerRef}
                className={`flex-1 overflow-auto flex justify-center bg-accent/30 rounded-md ${isFullScreen ? 'fullscreen-pdf' : ''}`}
              >
                {file.type === 'application/pdf' ? (
                  <iframe
                    ref={iframeRef}
                    src={getIframeSrc()}
                    className="w-full h-full border-0"
                    title="PDF Viewer"
                    sandbox="allow-same-origin allow-scripts"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="bg-muted p-8 rounded-lg text-center">
                      <h3 className="text-lg font-medium mb-2">Preview not available</h3>
                      <p className="text-muted-foreground mb-4">
                        This file type ({file.type}) cannot be previewed in the browser.
                      </p>
                      <Button onClick={downloadFile}>
                        <Download className="h-4 w-4 mr-2" />
                        Download to view
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="flex justify-center items-center flex-1">
          <div className="bg-muted p-8 rounded-lg text-center">
            <h3 className="text-lg font-medium mb-2">File not found</h3>
            <p className="text-muted-foreground mb-4">
              The requested file could not be found or you don't have permission to view it.
            </p>
            <Button onClick={() => router.push('/dashboard/files')}>
              Go back to files
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
