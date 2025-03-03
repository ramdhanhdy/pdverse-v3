import React, { useState, useEffect, useRef } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FileText, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

type FileAttachment = {
  id: string;
  name: string;
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
  const [availableFiles, setAvailableFiles] = useState<FileAttachment[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
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
      const files = data.files.map((file: any) => ({
        id: file.id,
        name: file.original_filename || file.filename,
      }));
      setAvailableFiles(files);
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

  const filteredFiles = availableFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <SheetTitle>Select Files</SheetTitle>
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
              <h3 className="text-sm font-medium mb-2">Attached Files</h3>
              <div className="space-y-1">
                {attachedFiles.map(file => (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between py-1 px-2 rounded-md text-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
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
            </div>
          )}
          
          <div className="p-4">
            <h3 className="text-sm font-medium mb-2">Available Files</h3>
            {isLoadingFiles ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredFiles.length > 0 ? (
              <div className={`space-y-1 ${isCompact ? 'compact-view' : ''}`}>
                {filteredFiles.map(file => (
                  <div 
                    key={file.id} 
                    className={`flex items-center py-1 px-2 rounded-md text-sm hover:bg-muted cursor-pointer ${
                      isCompact ? 'h-7 overflow-hidden' : ''
                    }`}
                    onClick={() => {
                      onAttachFile(file);
                      if (!attachedFiles.some(f => f.id === file.id)) {
                        setSearchQuery('');
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No files found</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 