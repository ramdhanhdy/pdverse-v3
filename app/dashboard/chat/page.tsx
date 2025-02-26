'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useChat } from 'ai/react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Simple type for file attachments
type FileAttachment = {
  id: string;
  name: string;
};

export default function ChatPage() {
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<FileAttachment[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [aiModel, setAiModel] = useState("GPT-4o");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Load AI model from settings
  useEffect(() => {
    const loadAiModel = () => {
      try {
        const savedModel = localStorage.getItem("ai_model") || "gpt-4o";
        // Convert model ID to display name
        const modelDisplayNames: Record<string, string> = {
          "gpt-4o": "GPT-4o",
          "gpt-4-turbo": "GPT-4 Turbo",
          "gpt-4": "GPT-4",
          "gpt-3.5-turbo": "GPT-3.5 Turbo"
        };
        setAiModel(modelDisplayNames[savedModel] || "GPT-4o");
      } catch (error) {
        console.error("Error loading AI model setting:", error);
      }
    };

    loadAiModel();
  }, []);

  // Initialize chat
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: {
      fileIds: attachedFiles.map(file => file.id),
    },
  });

  // Fetch available files for the file picker
  const fetchAvailableFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const response = await fetch("/api/files");
      if (!response.ok) throw new Error("Failed to fetch files");
      const data = await response.json();
      
      // Handle empty response or no files
      if (!data || !data.files || data.files.length === 0) {
        setAvailableFiles([]);
        return;
      }
      
      // Map files to a simpler format
      const files = data.files.map((file: any) => ({
        id: file.id,
        name: file.original_filename || file.filename
      }));
      
      setAvailableFiles(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      setAvailableFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Handle attaching a file
  const handleAttachFile = (file: FileAttachment) => {
    if (!attachedFiles.some(f => f.id === file.id)) {
      setAttachedFiles([...attachedFiles, file]);
    }
    setIsDialogOpen(false);
  };

  // Handle removing an attached file
  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(attachedFiles.filter(file => file.id !== fileId));
  };

  // Custom submit handler
  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(e);
    // Reset text area height
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Container with max-width for better readability */}
      <div className="w-full max-w-3xl mx-auto flex flex-col h-full relative">
        {/* Messages display - smaller text size */}
        <div className={`flex-1 overflow-y-auto px-4 pt-4 space-y-5 ${attachedFiles.length > 0 ? 'mb-[180px]' : 'mb-[140px]'}`}>
          {messages.map(message => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex flex-col">
                {message.role !== 'user' && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-medium ml-1 mb-1 w-fit">
                    <span className="h-1 w-1 rounded-full bg-green-500"></span>
                    <span>{aiModel}</span>
                  </div>
                )}
                <div 
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <div className="mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 9H16M8 13H14M18 15L21 18V4C21 3.46957 20.7893 2.96086 20.4142 2.58579C20.0391 2.21071 19.5304 2 19 2H5C4.46957 2 3.96086 2.21071 3.58579 2.58579C3.21071 2.96086 3 3.46957 3 4V18C3 18.5304 3.21071 19.0391 3.58579 19.4142C3.96086 19.7893 4.46957 20 5 20H18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-lg">Welcome to PDVerse Chat</p>
              <p className="text-sm text-muted-foreground mt-2">Ask any question or attach PDFs to ask about your documents</p>
            </div>
          )}
        </div>
        
        {/* Attached files display */}
        {attachedFiles.length > 0 && (
          <div className="px-4 py-3 absolute bottom-[76px] left-0 right-0 bg-background border-t">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {attachedFiles.map(file => (
                <div key={file.id} className="bg-muted px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <span className="truncate max-w-xs">{file.name}</span>
                  <button 
                    onClick={() => handleRemoveFile(file.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove file"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Input form */}
        <div className="px-4 pt-2 pb-4 absolute bottom-0 left-0 right-0 bg-background border-t">
          <form onSubmit={handleMessageSubmit} className="relative max-w-3xl mx-auto flex items-center gap-2">
            <div className="relative shadow-sm rounded-lg border border-input flex-1">
              <Textarea
                ref={textAreaRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Ask any question or ask about attached PDFs..."
                className="w-full p-3 pr-12 min-h-[50px] max-h-[150px] resize-none rounded-lg border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }
                }}
              />
              
              {/* File attachment button */}
              <button 
                type="button" 
                className="absolute right-2 bottom-[10px] p-1.5 rounded-full hover:bg-muted transition-colors"
                onClick={() => {
                  setIsDialogOpen(true);
                  fetchAvailableFiles();
                }}
                aria-label="Attach files"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            
            {/* Send button */}
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 rounded-full p-0 flex-shrink-0"
              aria-label="Send message"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.6667 1.33334L7.33334 8.66668M14.6667 1.33334L10 14.6667L7.33334 8.66668M14.6667 1.33334L1.33334 6.00001L7.33334 8.66668" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Button>
          </form>
        </div>
      
        {/* File selection dialog */}
        {isDialogOpen && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Attach PDF Files</DialogTitle>
              </DialogHeader>
              <div className="py-4 max-h-[400px] overflow-y-auto">
                {isLoadingFiles ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : availableFiles.length > 0 ? (
                  <div className="space-y-2">
                    {availableFiles.map(file => (
                      <div 
                        key={file.id} 
                        className="flex items-center p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => handleAttachFile(file)}
                      >
                        <div className="mr-3 text-muted-foreground">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.5 15.8333V17.5H2.5V15.8333H17.5ZM4.16667 3.33333H15.8333V10.8333H4.16667V3.33333ZM5.83333 5V9.16667H14.1667V5H5.83333ZM8.33333 11.6667H11.6667V14.1667H8.33333V11.6667Z" fill="currentColor"/>
                          </svg>
                        </div>
                        <div className="font-medium truncate">{file.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="mb-2">
                      <svg className="mx-auto" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <p>No files available. Please upload some PDFs first.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
