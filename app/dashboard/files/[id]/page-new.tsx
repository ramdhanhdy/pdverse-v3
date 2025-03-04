'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  Download, 
  Printer, 
  Share2, 
  Star, 
  Trash2, 
  FileText,
  Info
} from 'lucide-react';
import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';

// Import the PDF viewer component with dynamic import to avoid SSR issues
const PdfViewer = dynamic(
  () => import('@/components/PdfViewer'),
  { ssr: false, loading: () => <LoadingSpinner /> }
);

// Types
interface FileDetails {
  id: string;
  filename: string;
  original_filename: string;
  size: number;
  path: string;
  mimetype: string;
  created_at: number;
  updated_at: number;
}

interface PdfMetadata {
  file_id: string;
  title?: string;
  author?: string;
  summary?: string;
  page_count?: number;
  creation_date?: string;
  modification_date?: string;
  document_type?: string;
  topics?: string[];
  ai_enhanced: boolean;
  needs_review: boolean;
  created_at: number;
  updated_at: number;
}

export default function FileViewPage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<FileDetails | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!params.id) return;
      
      try {
        setIsLoading(true);
        
        try {
          // Try to get document from Python backend
          const response = await fetch(`/api/files?id=${params.id}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
          
          const documentData = await response.json();
          
          // Convert Python backend format to our frontend format
          const fileData: FileDetails = {
            id: documentData.id,
            filename: documentData.filename,
            original_filename: documentData.title,
            size: documentData.file_size || 0,
            path: `/api/files/${documentData.id}/pdf`, // Use our new PDF serving endpoint
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
            creation_date: documentData.creation_date,
            modification_date: documentData.modification_date,
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
          toast.error("Failed to load file details. Please try again.");
          router.push("/dashboard/files");
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

  const handleDownload = async () => {
    if (!file) return;
    
    try {
      const response = await fetch(file.path);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file. Please try again.");
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

  const handleDocumentLoad = (numPages: number) => {
    setTotalPages(numPages);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">File Not Found</h2>
        <p className="text-muted-foreground mb-4">The file you're looking for doesn't exist or has been deleted.</p>
        <Button onClick={() => router.push('/dashboard/files')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Files
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="icon" 
            className="mr-2"
            onClick={() => router.push('/dashboard/files')}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <h1 className="text-2xl font-bold truncate max-w-[500px]">
            {metadata?.title || file.original_filename}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Star className="h-4 w-4" />
            <span className="sr-only">Favorite</span>
          </Button>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
            <span className="sr-only">Share</span>
          </Button>
          <Button variant="outline" size="icon" className="text-destructive">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="view">
        <TabsList className="mb-4">
          <TabsTrigger value="view">View</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="view">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col h-[calc(100vh-250px)]">
                <div className="px-4 py-2 border-b flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {totalPages > 0 ? `${totalPages} pages` : 'Loading...'}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  {file.mimetype === 'application/pdf' ? (
                    <PdfViewer 
                      fileUrl={file.path} 
                      onDocumentLoad={handleDocumentLoad}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="bg-muted p-8 rounded-lg text-center">
                        <h3 className="text-lg font-medium mb-2">Preview not available</h3>
                        <p className="text-muted-foreground mb-4">
                          This file type ({file.mimetype}) cannot be previewed in the browser.
                        </p>
                        <Button onClick={handleDownload}>
                          <Download className="h-4 w-4 mr-2" />
                          Download to view
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="details">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Info className="h-5 w-5 mr-2 text-muted-foreground" />
                    File Information
                  </h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Filename</dt>
                      <dd className="font-medium">{file.original_filename}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">File Type</dt>
                      <dd className="font-medium">{file.mimetype}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Uploaded</dt>
                      <dd className="font-medium">{new Date(file.created_at * 1000).toLocaleDateString()}</dd>
                    </div>
                  </dl>
                </div>
                
                {metadata && (
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                      Document Metadata
                    </h3>
                    <dl className="space-y-2">
                      {metadata.title && (
                        <div className="flex justify-between py-1 border-b">
                          <dt className="text-muted-foreground">Title</dt>
                          <dd className="font-medium">{metadata.title}</dd>
                        </div>
                      )}
                      {metadata.author && (
                        <div className="flex justify-between py-1 border-b">
                          <dt className="text-muted-foreground">Author</dt>
                          <dd className="font-medium">{metadata.author}</dd>
                        </div>
                      )}
                      {metadata.page_count && (
                        <div className="flex justify-between py-1 border-b">
                          <dt className="text-muted-foreground">Pages</dt>
                          <dd className="font-medium">{metadata.page_count}</dd>
                        </div>
                      )}
                      {metadata.creation_date && (
                        <div className="flex justify-between py-1 border-b">
                          <dt className="text-muted-foreground">Created</dt>
                          <dd className="font-medium">{new Date(metadata.creation_date).toLocaleDateString()}</dd>
                        </div>
                      )}
                      {metadata.document_type && (
                        <div className="flex justify-between py-1 border-b">
                          <dt className="text-muted-foreground">Document Type</dt>
                          <dd className="font-medium">{metadata.document_type}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
              
              {metadata?.summary && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Summary</h3>
                  <p className="text-muted-foreground">{metadata.summary}</p>
                </div>
              )}
              
              {metadata?.topics && metadata.topics.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {metadata.topics.map((topic, index) => (
                      <div key={index} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 