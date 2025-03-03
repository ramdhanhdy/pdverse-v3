'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useChat } from '@ai-sdk/react';
import { Textarea } from '@/components/ui/textarea';
import { ChatModeSelector } from './components/ChatModeSelector';
import { FileSidebar } from './components/FileSidebar';

type FileAttachment = {
  id: string;
  name: string;
};

export default function ChatPage() {
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isFileSidebarOpen, setIsFileSidebarOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'document' | 'general' | 'search' | 'advanced'>('general');
  const [usePythonBackend, setUsePythonBackend] = useState<boolean>(false);
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
    },
    onFinish: (message) => {
      console.log('Stream finished with message:', message);
    },
    onError: (error) => {
      console.error('useChat error:', error);
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="w-full max-w-3xl mx-auto flex flex-col h-full relative">
        <div className="flex-1 overflow-y-auto px-4 space-y-5 mb-[140px] pt-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex flex-col">
                {message.role !== 'user' && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-medium ml-1 mb-1 w-fit">
                    <span className="h-1 w-1 rounded-full bg-green-500"></span>
                    <span>GPT-4o</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 9H16M8 13H14M18 15L21 18V4C21 3.46957 20.7893 2.96086 20.4142 2.58579C20.0391 2.21071 19.5304 2 19 2H5C4.46957 2 3.96086 2.21071 3.58579 2.58579C3.21071 2.96086 3 3.46957 3 4V18C3 18.5304 3.21071 19.0391 3.58579 19.4142C3.96086 19.7893 4.46957 20 5 20H18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-lg">Welcome to PDVerse Chat</p>
              <p className="text-sm text-muted-foreground mt-2">Ask any question or attach PDFs to ask about your documents</p>
            </div>
          )}
        </div>

        <div className="px-4 pt-2 pb-4 absolute bottom-0 left-0 right-0 bg-background border-t">
          {attachedFiles.length > 0 && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center">
              <div className="text-xs text-muted-foreground">
                {attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} attached
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
          
          <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto flex items-center gap-2">
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
                className={`px-2 py-1 text-xs rounded-md ${
                  usePythonBackend 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}
                title={usePythonBackend ? "Using Python Backend" : "Using AI SDK Directly"}
              >
                {usePythonBackend ? "PY" : "SDK"}
              </button>
            )}
            <div className="relative shadow-sm rounded-lg border border-input flex-1">
              <Textarea
                ref={textAreaRef}
                value={input}
                onChange={handleInputChange}
                placeholder={`Ask a question in ${chatMode === 'document' ? 'Document Chat' : 
                              chatMode === 'general' ? 'General Chat' : 
                              chatMode === 'search' ? 'Search Mode' : 'Advanced Analysis'} mode...`}
                className="w-full p-3 pr-12 min-h-[50px] max-h-[150px] resize-none rounded-lg border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const form = e.currentTarget.closest('form');
                    if (form && !isLoading && input.trim()) {
                      form.requestSubmit();
                    }
                  }
                }}
              />
              {chatMode === 'document' && (
                <button 
                  type="button" 
                  className="absolute right-2 bottom-[10px] p-1.5 rounded-full hover:bg-muted transition-colors"
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