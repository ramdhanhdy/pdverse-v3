'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useChat } from '@ai-sdk/react';
import { Textarea } from '@/components/ui/textarea';
import { ChatModeSelector } from './components/ChatModeSelector';
import { FileSidebar } from './components/FileSidebar';
import { DocumentChatMessage } from './components/DocumentChatMessage';
import { Loader2, FileText, Send } from 'lucide-react';

type FileAttachment = {
  id: string;
  name: string;
};

export default function ChatPage() {
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isFileSidebarOpen, setIsFileSidebarOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'document' | 'general' | 'search' | 'advanced'>('general');
  const [usePythonBackend, setUsePythonBackend] = useState<boolean>(false);
  const [isProcessingDocuments, setIsProcessingDocuments] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
    body: {
      fileIds: attachedFiles.map(file => file.id),
      chatMode: chatMode,
      usePythonBackend: usePythonBackend,
    },
    initialMessages: [],
    streamProtocol: 'text',
    onResponse: (response) => {
      console.log('Raw response received:', response);
      console.log('Response status:', response.status);
      
      // Log headers safely
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log('Response headers:', headers);
      
      // Set processing state to false when response is received
      setIsProcessingDocuments(false);
    },
    onFinish: (message) => {
      console.log('Stream finished with message:', message);
      setIsProcessingDocuments(false);
    },
    onError: (error) => {
      console.error('useChat error:', error);
      setIsProcessingDocuments(false);
    },
  });

  // Log messages and loading state
  useEffect(() => {
    console.log('Messages updated:', messages);
    console.log('isLoading:', isLoading);
  }, [messages, isLoading]);

  const handleAttachFile = (file: FileAttachment) => {
    if (!attachedFiles.some(f => f.id === file.id)) {
      setAttachedFiles([...attachedFiles, file]);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(attachedFiles.filter(file => file.id !== fileId));
  };

  // Set chat mode to document if files are attached
  useEffect(() => {
    if (attachedFiles.length > 0 && chatMode !== 'document') {
      setChatMode('document');
    }
  }, [attachedFiles, chatMode]);
  
  // Custom submit handler to set processing state
  const handleCustomSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Set processing state to true when submitting in document mode
    if (chatMode === 'document' && attachedFiles.length > 0) {
      setIsProcessingDocuments(true);
    }
    
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full relative px-4 sm:px-6 lg:px-8">
        <div className="flex-1 overflow-y-auto space-y-5 mb-[140px] pt-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%] sm:max-w-[85%] md:max-w-[80%]`}>
                {message.role !== 'user' && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-medium ml-1 mb-1 w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    <span>GPT-4o</span>
                  </div>
                )}
                <div
                  className={`w-full rounded-lg p-4 text-sm shadow-sm ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-muted rounded-tl-none'
                  }`}
                >
                  {chatMode === 'document' && !isLoading ? (
                    <DocumentChatMessage 
                      content={message.content} 
                      isUser={message.role === 'user'} 
                      documentInfo={attachedFiles.map(file => ({
                        id: file.id,
                        title: file.name,
                      }))}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 px-1">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <div className="bg-primary/5 p-6 rounded-full mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                  <path d="M8 9H16M8 13H14M18 15L21 18V4C21 3.46957 20.7893 2.96086 20.4142 2.58579C20.0391 2.21071 19.5304 2 19 2H5C4.46957 2 3.96086 2.21071 3.58579 2.58579C3.21071 2.96086 3 3.46957 3 4V18C3 18.5304 3.21071 19.0391 3.58579 19.4142C3.96086 19.7893 4.46957 20 5 20H18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground">Welcome to PDVerse Chat</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">Ask any question or attach PDFs to ask about your documents</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl">
                <div className="bg-card p-4 rounded-lg border shadow-sm">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <span className="bg-primary/20 p-1 rounded-md">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    General Chat
                  </h3>
                  <p className="text-sm text-muted-foreground">Ask any question and get answers from our AI assistant</p>
                </div>
                <div className="bg-card p-4 rounded-lg border shadow-sm">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <span className="bg-primary/20 p-1 rounded-md">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    Document Chat
                  </h3>
                  <p className="text-sm text-muted-foreground">Upload documents and ask questions about their content</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Document processing indicator */}
          {isProcessingDocuments && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg text-sm shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing documents...</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pt-3 pb-6 absolute bottom-0 left-0 right-0 bg-background border-t backdrop-blur-sm bg-background/80">
          {attachedFiles.length > 0 && (
            <div className="max-w-5xl mx-auto mb-3 flex items-center">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-1 rounded-md">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {attachedFiles.length} document{attachedFiles.length !== 1 ? 's' : ''} attached
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs ml-2"
                onClick={() => setIsFileSidebarOpen(true)}
              >
                Manage
              </Button>
            </div>
          )}
          
          <form onSubmit={handleCustomSubmit} className="relative max-w-5xl mx-auto">
            <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-2xl border shadow-sm">
              <div className="flex items-center gap-2 pl-2">
                <ChatModeSelector 
                  currentMode={chatMode}
                  onModeChange={(mode) => {
                    setChatMode(mode);
                    if (mode !== 'document') setAttachedFiles([]);
                  }}
                  compact={true}
                />
                {chatMode === 'general' && (
                  <button
                    type="button"
                    onClick={() => setUsePythonBackend(!usePythonBackend)}
                    className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                      usePythonBackend 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                    title={usePythonBackend ? "Using Python Backend" : "Using AI SDK Directly"}
                  >
                    {usePythonBackend ? "PY" : "SDK"}
                  </button>
                )}
              </div>
              <div className="relative flex-1 bg-background rounded-xl overflow-hidden">
                <Textarea
                  ref={textAreaRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder={`Ask a question in ${chatMode === 'document' ? 'Document Chat' : 
                                chatMode === 'general' ? 'General Chat' : 
                                chatMode === 'search' ? 'Search Mode' : 'Advanced Analysis'} mode...`}
                  className="w-full p-3 pr-12 min-h-[60px] max-h-[180px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const form = e.currentTarget.closest('form');
                      if (form && !isLoading && input.trim()) {
                        if (chatMode === 'document' && attachedFiles.length > 0) {
                          setIsProcessingDocuments(true);
                        }
                        form.requestSubmit();
                      }
                    }
                  }}
                />
                {chatMode === 'document' && (
                  <button 
                    type="button" 
                    className="absolute right-2 bottom-[14px] p-1.5 rounded-full hover:bg-muted transition-colors"
                    onClick={() => setIsFileSidebarOpen(true)}
                    aria-label="Attach files"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="h-12 w-12 rounded-full p-0 flex-shrink-0 shadow-md mr-1 bg-primary hover:bg-primary/90 transition-colors"
                aria-label="Send message"
              >
                {isLoading ? (
                  <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </form>
        </div>

        <FileSidebar
          isOpen={isFileSidebarOpen}
          onOpenChange={setIsFileSidebarOpen}
          onAttachFile={handleAttachFile}
          attachedFiles={attachedFiles}
          onRemoveFile={handleRemoveFile}
        />
      </div>
    </div>
  );
}