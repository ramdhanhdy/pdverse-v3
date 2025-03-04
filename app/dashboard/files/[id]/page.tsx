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
  Trash2, PanelRightClose, PanelRight, MessageSquare, X, Send,
  Maximize2, Minimize2, GripVertical, FileSearch, Globe, CornerRightDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getDocumentFromPythonBackend } from "@/lib/python-backend";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@ai-sdk/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showOutline, setShowOutline] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [chatPosition, setChatPosition] = useState({ x: -1, y: -1 });
  const [chatSize, setChatSize] = useState({ width: 384, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ width: 0, height: 0 });
  const [chatMode, setChatMode] = useState<'document' | 'general'>('document');
  const [resizeActive, setResizeActive] = useState(false);

  // Chat functionality
  const { messages, input, handleInputChange, handleSubmit, isLoading: isChatLoading, setInput } = useChat({
    api: '/api/chat',
    body: {
      fileIds: file ? [file.id] : [],
      chatMode: chatMode,
      usePythonBackend: true,
    },
    initialMessages: [],
    streamProtocol: 'text',
  });

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
            path: `/api/files/${documentData.id}/pdf`, // Use our PDF serving endpoint
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
          if (metadataData.page_count) {
            setTotalPages(metadataData.page_count);
          }
          
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
          
          // Update the path to use our PDF serving endpoint
          if (fileData) {
            fileData.path = `/api/files/${fileData.id}/pdf`;
          }
          
          setFile(fileData);
          
          // Fetch PDF metadata if available
          if (fileData && fileData.id) {
            try {
              const metadataResponse = await fetch(`/api/pdf-metadata?fileId=${fileData.id}`);
              if (metadataResponse.ok) {
                const metadataData = await metadataResponse.json();
                setMetadata(metadataData.metadata);
                if (metadataData.metadata && metadataData.metadata.page_count) {
                  setTotalPages(metadataData.metadata.page_count);
                }
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
    if (showChat && chatPosition.x === -1 && chatPosition.y === -1) {
      setChatPosition({
        x: window.innerWidth - chatSize.width - 16,
        y: window.innerHeight - chatSize.height - 16
      });
    }
  }, [showChat, chatPosition, chatSize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep chat within viewport bounds
        const maxX = window.innerWidth - chatSize.width;
        const maxY = window.innerHeight - (isMinimized ? 40 : chatSize.height);
        
        setChatPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
      
      if (isResizing) {
        const newWidth = initialSize.current.width + (e.clientX - resizeStartPos.current.x);
        const newHeight = initialSize.current.height + (e.clientY - resizeStartPos.current.y);
        
        // Set minimum and maximum sizes
        const width = Math.max(300, Math.min(newWidth, window.innerWidth * 0.8));
        const height = Math.max(300, Math.min(newHeight, window.innerHeight * 0.8));
        
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          setChatSize({ width, height });
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeActive(false);
      document.body.style.cursor = '';
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Prevent text selection during resize/drag
      document.body.style.userSelect = 'none';
      
      // Set cursor for entire document during resize
      if (isResizing) {
        document.body.style.cursor = 'nwse-resize';
      } else if (isDragging) {
        document.body.style.cursor = 'move';
      }
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isResizing, dragOffset, chatSize, isMinimized]);

  const startDragging = (e: React.MouseEvent) => {
    if (chatRef.current) {
      const rect = chatRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
      
      // Prevent text selection during drag
      e.preventDefault();
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    initialSize.current = { ...chatSize };
    setIsResizing(true);
    setResizeActive(true);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const goToPrevPage = () => {
    // Browser's PDF viewer handles page navigation internally
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    // Browser's PDF viewer handles page navigation internally
    setPageNumber((prev) => Math.min(prev + 1, totalPages || Infinity));
  };

  const zoomIn = () => {
    // Browser's PDF viewer handles zoom internally
    setScale((prev) => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    // Browser's PDF viewer handles zoom internally
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

  const handleSearch = () => {
    if (searchText.trim()) {
      // Browser's PDF viewer handles search internally
    }
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

  // Create a direct URL to the PDF file
  const getPdfViewerUrl = () => {
    if (!file) return '';
    
    // Use the direct path to the PDF file
    return file.path;
  };

  const toggleMetadataPanel = () => {
    setShowMetadata(!showMetadata);
  };

  const toggleChatPanel = () => {
    setShowChat(!showChat);
    // Focus the chat input when opening
    if (!showChat) {
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    }
  };

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    handleSubmit(e);
    
    // Scroll to bottom of chat after sending
    setTimeout(() => {
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }, 100);
  };

  const handleChatModeChange = (mode: 'document' | 'general') => {
    setChatMode(mode);
    // Clear messages when switching modes
    if (messages.length > 0) {
      if (window.confirm("Changing chat mode will clear your current conversation. Continue?")) {
        // Reset chat by refreshing the component
        setShowChat(false);
        setTimeout(() => setShowChat(true), 100);
      } else {
        // Revert selection if user cancels
        setChatMode(mode === 'document' ? 'general' : 'document');
      }
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
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {file.original_filename}
          </h1>
          <div className="text-sm text-muted-foreground">
            {formatBytes(file.size)} • 
            {new Date(file.updated_at * 1000).toLocaleDateString()}
            {metadata?.author && ` • Author: ${metadata.author}`}
          </div>
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

      <div className={`grid ${showMetadata ? 'grid-cols-1 md:grid-cols-[3fr_1fr]' : 'grid-cols-1'} gap-2 h-full transition-all duration-300`}>
        <div className="flex flex-col h-full">
          <Card className="p-2 flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => router.push("/dashboard/files")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Back</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
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
                  onClick={toggleMetadataPanel}
                  title={showMetadata ? "Hide metadata" : "Show metadata"}
                >
                  {showMetadata ? 
                    <PanelRightClose className="h-4 w-4" /> : 
                    <PanelRight className="h-4 w-4" />
                  }
                  <span className="sr-only">
                    {showMetadata ? "Hide metadata" : "Show metadata"}
                  </span>
                </Button>
                <Button 
                  variant={showChat ? "default" : "outline"}
                  size="icon" 
                  onClick={toggleChatPanel}
                  title={showChat ? "Hide chat" : "Chat with document"}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="sr-only">
                    {showChat ? "Hide chat" : "Chat with document"}
                  </span>
                </Button>
              </div>
            </div>
            
            <div 
              ref={pdfContainerRef}
              className={`flex-1 overflow-auto flex justify-center bg-accent/30 rounded-md ${isFullScreen ? 'fullscreen-pdf' : ''}`}
              style={{ height: 'calc(100vh - 140px)', minHeight: '600px' }}
            >
              {file.mimetype === 'application/pdf' && (
                <object
                  data={getPdfViewerUrl()}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-red-500 font-medium mb-2">
                      Unable to display PDF. Your browser might not support PDF viewing.
                    </p>
                    <Button onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download to view
                    </Button>
                  </div>
                </object>
              )}
            </div>
          </Card>
        </div>

        {showMetadata && (
          <div 
            className="space-y-2 overflow-auto h-full" 
            style={{ 
              height: 'calc(100vh - 140px)',
              minHeight: '600px'
            }}
          >
            <Card className="p-3 h-auto">
              <h2 className="text-lg font-semibold mb-3">File Information</h2>
              <div className="space-y-3">
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
              <Card className="p-3 h-auto">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold">PDF Metadata</h2>
                </div>
                <FileMetadataSection metadata={metadata} />
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Floating Chat Interface */}
      {showChat && (
        <div 
          ref={chatRef}
          className={`fixed bg-background border rounded-lg shadow-lg flex flex-col z-50 ${isResizing ? 'transition-none' : 'transition-all duration-200'}`}
          style={{ 
            width: chatSize.width, 
            height: isMinimized ? '40px' : chatSize.height,
            left: chatPosition.x,
            top: chatPosition.y,
            transition: isDragging || isResizing ? 'none' : 'height 0.2s ease-in-out'
          }}
        >
          <div 
            className="flex items-center justify-between p-3 border-b cursor-move select-none"
            onMouseDown={startDragging}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Chat with this document</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleMinimize} title={isMinimized ? "Expand" : "Minimize"}>
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleChatPanel} title="Close chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {!isMinimized && (
            <>
              <div className="px-3 pt-2">
                <Tabs 
                  value={chatMode} 
                  onValueChange={(value) => handleChatModeChange(value as 'document' | 'general')}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TabsTrigger value="document" className="flex items-center gap-1">
                            <FileSearch className="h-4 w-4" />
                            <span>Document</span>
                          </TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ask questions about this document</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TabsTrigger value="general" className="flex items-center gap-1">
                            <Globe className="h-4 w-4" />
                            <span>General</span>
                          </TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>General conversation (not document-specific)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TabsList>
                </Tabs>
              </div>
              
              <div 
                id="chat-messages"
                className="flex-1 overflow-auto p-3 space-y-4"
              >
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm p-4">
                    {chatMode === 'document' ? (
                      <>
                        <p>Ask questions about this document.</p>
                        <p className="mt-2">For example:</p>
                        <ul className="text-left mt-2 space-y-1">
                          <li>• Summarize the key points</li>
                          <li>• What is the main topic?</li>
                          <li>• Explain the section about...</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <p>Ask any general questions.</p>
                        <p className="mt-2">For example:</p>
                        <ul className="text-left mt-2 space-y-1">
                          <li>• How do I create a PDF?</li>
                          <li>• What are best practices for document organization?</li>
                          <li>• Help me draft an email about...</li>
                        </ul>
                      </>
                    )}
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div 
                      key={index} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleChatSubmit} className="p-3 border-t">
                <div className="flex gap-2">
                  <Textarea
                    ref={chatInputRef}
                    value={input}
                    onChange={handleInputChange}
                    placeholder={chatMode === 'document' 
                      ? "Ask about this document..." 
                      : "Ask any question..."}
                    className="min-h-10 resize-none"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit(e as any);
                      }
                    }}
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={isChatLoading || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
          
          {/* Resize handle */}
          {!isMinimized && (
            <div 
              className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-10 ${resizeActive ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
              onMouseDown={startResizing}
              title="Resize chat"
            >
              <CornerRightDown className="h-4 w-4 absolute bottom-1 right-1 text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
