import React, { useState, useEffect, useRef } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FileText, X, Search, ChevronLeft, ChevronRight, Info, Calendar, FileType, Hash, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';

type FileAttachment = {
  id: string;
  name: string;
};

type DocumentInfo = {
  id: string;
  title: string;
  author: string;
  creation_date: string | null;
  page_count: number;
  file_size: number;
  document_type: string;
  filename: string;
};

interface FileSidebarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAttachFile: (file: FileAttachment) => void;
  attachedFiles: FileAttachment[];
  onRemoveFile: (fileId: string) => void;
}

export function FileSidebar({ 
  isOpen, 
  onOpenChange, 
  onAttachFile, 
  attachedFiles,
  onRemoveFile
}: FileSidebarProps) {
  const [availableFiles, setAvailableFiles] = useState<DocumentInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const fetchAvailableFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const response = await fetch('/api/files');
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      if (!data?.files) {
        setAvailableFiles([]);
        return;
      }
      setAvailableFiles(data.files);
    } catch (error) {
      console.error('Error fetching files:', error);
      setAvailableFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAvailableFiles();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizingRef.current) return;
      
      const deltaX = e.clientX - resizingRef.current.startX;
      const newWidth = Math.max(250, Math.min(600, resizingRef.current.startWidth - deltaX));
      
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizingRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizingRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
  };

  const toggleCompactMode = () => {
    setIsCompact(!isCompact);
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date to human-readable format
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get display name for a file
  const getFileDisplayName = (file: DocumentInfo) => {
    return file.title || file.filename;
  };

  // Get file details for display
  const getFileDetails = (file: DocumentInfo) => {
    const details = [];
    
    // Add author if available
    if (file.author) details.push(file.author);
    
    // Add page count if available
    if (file.page_count) details.push(`${file.page_count} pages`);
    
    // Add file size if available
    if (file.file_size) details.push(formatFileSize(file.file_size));
    
    // Add document type if available
    if (file.document_type) details.push(file.document_type.toUpperCase());
    
    return details.join(' • ');
  };

  const filteredFiles = availableFiles.filter(file => 
    (file.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (file.filename?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (file.author?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  // Find document info for attached files
  const getAttachedFileInfo = (fileId: string) => {
    const fileInfo = availableFiles.find(file => file.id === fileId);
    return fileInfo ? getFileDisplayName(fileInfo) : 'Unknown file';
  };

  // Handle file selection
  const handleFileClick = (file: DocumentInfo) => {
    setSelectedFile(file.id);
    
    // If the file is already attached, don't do anything
    if (attachedFiles.some(f => f.id === file.id)) {
      return;
    }
    
    // Attach the file
    onAttachFile({
      id: file.id,
      name: getFileDisplayName(file)
    });
  };

  // Check if a file is attached
  const isFileAttached = (fileId: string) => {
    return attachedFiles.some(file => file.id === fileId);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="p-0 flex flex-col overflow-hidden" 
        hideCloseButton={true}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20 z-50"
          onMouseDown={startResizing}
        />
        
        <SheetHeader className="p-4 border-b">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <SheetTitle>Select Documents</SheetTitle>
              <div className="ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-primary/30">
                <Layers className="h-3 w-3 mr-1" />
                Multi-Doc Chat
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={toggleCompactMode}
                title={isCompact ? "Expand view" : "Compact view"}
              >
                {isCompact ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-auto">
          {attachedFiles.length > 0 && (
            <div className="p-4 border-b">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <Layers className="h-4 w-4 mr-1" />
                Attached Documents ({attachedFiles.length})
              </h3>
              <div className="space-y-1">
                {attachedFiles.map(file => (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between py-1 px-2 rounded-md text-sm hover:bg-muted/50 bg-muted/30"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="truncate">{getAttachedFileInfo(file.id)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRemoveFile(file.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              {attachedFiles.length > 1 && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  Multi-document chat enabled. Ask questions across all documents.
                </div>
              )}
            </div>
          )}
          
          <div className="p-4">
            <h3 className="text-sm font-medium mb-2">Available Documents</h3>
            {isLoadingFiles ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredFiles.length > 0 ? (
              <div className={`space-y-1 ${isCompact ? 'compact-view' : ''}`}>
                {filteredFiles.map(file => (
                  <div 
                    key={file.id} 
                    className={`flex flex-col py-2 px-3 rounded-md text-sm hover:bg-muted cursor-pointer transition-colors ${
                      isCompact ? 'h-7 overflow-hidden' : ''
                    } ${isFileAttached(file.id) ? 'bg-primary/10 border border-primary/30' : ''}`}
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className={`h-4 w-4 flex-shrink-0 ${isFileAttached(file.id) ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`truncate font-medium ${isFileAttached(file.id) ? 'text-primary' : ''}`}>
                          {getFileDisplayName(file)}
                        </span>
                      </div>
                      {isFileAttached(file.id) && (
                        <div className="ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/20 text-primary border-primary/30">
                          Selected
                        </div>
                      )}
                    </div>
                    
                    {!isCompact && (
                      <>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                          {file.author && (
                            <span className="flex items-center">
                              <Info className="h-3 w-3 mr-1" />
                              {file.author}
                            </span>
                          )}
                          {file.page_count > 0 && (
                            <span className="flex items-center">
                              <Hash className="h-3 w-3 mr-1" />
                              {file.page_count} pages
                            </span>
                          )}
                          {file.document_type && (
                            <span className="flex items-center">
                              <FileType className="h-3 w-3 mr-1" />
                              {file.document_type}
                            </span>
                          )}
                          {file.creation_date && (
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(file.creation_date)}
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-1 text-xs text-muted-foreground">
                          {file.file_size > 0 && formatFileSize(file.file_size)}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No documents match your search' : 'No documents available'}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {filteredFiles.length} document{filteredFiles.length !== 1 ? 's' : ''} available
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => fetchAvailableFiles()}
              title="Refresh document list"
            >
              Refresh
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 