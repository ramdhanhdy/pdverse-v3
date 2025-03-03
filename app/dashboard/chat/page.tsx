'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useChat } from '@ai-sdk/react';
import { Textarea } from '@/components/ui/textarea';
import { ChatModeSelector } from './components/ChatModeSelector';
import { X } from 'lucide-react';

type FileAttachment = {
  id: string;
  name: string;
  title?: string;
  pageCount?: number;
  creationDate?: string;
};

export default function ChatPage() {
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<FileAttachment[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileAttachment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [chatMode, setChatMode] = useState<'document' | 'general' | 'search' | 'advanced'>('general');
  const [usePythonBackend, setUsePythonBackend] = useState<boolean>(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [chatId, setChatId] = useState<string>(Date.now().toString());

  // Reset chat when files or chat mode changes
  useEffect(() => {
    // Generate a new chat ID to force the useChat hook to reset
    setChatId(Date.now().toString());
    console.log(`Chat reset due to ${chatMode} mode with ${attachedFiles.length} files`);
    
    // If switching to document mode without files, show file selection
    if (chatMode === 'document' && attachedFiles.length === 0) {
      setIsSidebarOpen(true);
      fetchAvailableFiles();
    }
  }, [attachedFiles, chatMode]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    id: chatId, // Add a unique ID that changes when files change
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

  // Add useEffect to filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(availableFiles);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = availableFiles.filter(file => 
      file.name.toLowerCase().includes(query) || 
      (file.title && file.title.toLowerCase().includes(query))
    );
    setFilteredFiles(filtered);
  }, [searchQuery, availableFiles]);

  const fetchAvailableFiles = async () => {
    setIsLoadingFiles(true);
    setSearchQuery(''); // Reset search query when fetching files
    try {
      const response = await fetch('/api/files');
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      if (!data?.files) {
        setAvailableFiles([]);
        setFilteredFiles([]);
        return;
      }
      const files = data.files.map((file: any) => ({
        id: file.id,
        name: file.original_filename || file.filename,
        title: file.title || 'Untitled Document',
        pageCount: file.page_count || 0,
        creationDate: file.creation_date ? new Date(file.creation_date).toLocaleDateString() : 'Unknown date'
      }));
      setAvailableFiles(files);
      setFilteredFiles(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      setAvailableFiles([]);
      setFilteredFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleAttachFile = (file: FileAttachment) => {
    if (!attachedFiles.some(f => f.id === file.id)) {
      setAttachedFiles([...attachedFiles, {
        id: file.id,
        name: file.name,
        title: file.title,
        pageCount: file.pageCount,
        creationDate: file.creationDate
      }]);
    }
    setIsSidebarOpen(false);
  };

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(attachedFiles.filter(file => file.id !== fileId));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="w-full max-w-3xl mx-auto flex flex-col h-full relative">
        <div className={`flex-1 overflow-y-auto px-4 space-y-5 ${attachedFiles.length > 0 ? 'mb-[180px]' : 'mb-[140px]'}`}>
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
                    {chatMode === 'document' && attachedFiles.length > 0 && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="flex items-center">
                          <svg className="mr-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="font-medium">{attachedFiles[0].title || attachedFiles[0].name}</span>
                        </span>
                      </>
                    )}
                    {chatMode === 'search' && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="flex items-center">
                          <svg className="mr-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="font-medium">Search Mode</span>
                        </span>
                      </>
                    )}
                    {chatMode === 'advanced' && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="flex items-center">
                          <svg className="mr-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="font-medium">Advanced Analysis</span>
                        </span>
                      </>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {message.content}
                    {message.role === 'assistant' && 
                     message.content.includes("Error:") && 
                     message.content.includes("document") && (
                      <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                        <p className="font-medium">Document retrieval issue detected</p>
                        <p>Try selecting a different document or refreshing the file list.</p>
                      </div>
                    )}
                  </div>
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

        {attachedFiles.length > 0 && (
          <div className="px-4 py-3 absolute bottom-[76px] left-0 right-0 bg-background border-t">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center mb-2 text-xs text-muted-foreground">
                <svg className="mr-1" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13 2v7h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Document Chat Mode Active</span>
                <span className="mx-1">•</span>
                <span className="font-medium">Using: {attachedFiles[0].title || attachedFiles[0].name}</span>
                {chatMode !== 'document' && (
                  <span className="ml-1 text-yellow-500 font-medium">
                    (Note: Document attached but {chatMode} mode active)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map(file => (
                  <div key={file.id} className="bg-muted px-3 py-2 rounded-lg text-sm flex items-center gap-2 border border-border">
                    <div className="flex flex-col">
                      <span className="font-medium truncate max-w-xs">{file.name}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-xs">ID: {file.id.substring(0, 8)}...</span>
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-1 hover:bg-muted-foreground/20 ml-1"
                      onClick={() => handleRemoveFile(file.id)}
                      aria-label="Remove file"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pt-2 pb-4 absolute bottom-0 left-0 right-0 bg-background border-t">
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
              {chatMode === 'document' && attachedFiles.length > 0 && (
                <div className="absolute left-3 top-3 text-muted-foreground">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13 2v7h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <Textarea
                ref={textAreaRef}
                value={input}
                onChange={handleInputChange}
                placeholder={`Ask a question in ${chatMode === 'document' ? 'Document Chat' : 
                              chatMode === 'general' ? 'General Chat' : 
                              chatMode === 'search' ? 'Search Mode' : 'Advanced Analysis'} mode...`}
                className={`w-full p-3 pr-12 min-h-[50px] max-h-[150px] resize-none rounded-lg border-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                  chatMode === 'document' && attachedFiles.length > 0 ? 'pl-9' : ''
                }`}
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
                  onClick={() => {
                    setIsSidebarOpen(true);
                    fetchAvailableFiles();
                  }}
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

        {/* File Selection Sidebar */}
        <div className={`fixed inset-y-0 right-0 w-72 bg-background border-l border-border shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-3 border-b">
            <h2 className="text-base font-semibold">Select PDF Files</h2>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.href = '/dashboard/documents/upload'}
                className="text-xs h-7 px-2"
              >
                Upload New
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSidebarOpen(false)}
                className="h-7 w-7"
              >
                <X size={16} />
              </Button>
            </div>
          </div>
          
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-1.5 px-7 border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <svg 
                  className="absolute left-2 top-1.5 text-muted-foreground" 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {searchQuery && (
                  <button
                    className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchAvailableFiles}
                className="ml-1 h-7 w-7"
                disabled={isLoadingFiles}
                title="Refresh file list"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Button>
            </div>

            {/* Currently attached files section */}
            {attachedFiles.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium">Currently Attached</h3>
                  <button 
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setAttachedFiles([])}
                  >
                    Remove All
                  </button>
                </div>
                <div className="space-y-1">
                  {attachedFiles.map(file => (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-xs truncate">{file.title || file.name}</span>
                      </div>
                      <button
                        className="p-0.5 rounded-full hover:bg-muted-foreground/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(file.id);
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="px-3 overflow-y-auto pb-16" style={{ maxHeight: 'calc(100vh - 110px)' }}>
            {isLoadingFiles ? (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredFiles.length > 0 ? (
              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  {searchQuery ? `${filteredFiles.length} results found` : 'Select a file to attach to your chat'}
                </div>
                <div className="space-y-1">
                {filteredFiles.map(file => (
                  <div 
                    key={file.id} 
                    className="flex items-center p-1.5 rounded-md border border-border hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => handleAttachFile(file)}
                  >
                    <div className="text-muted-foreground mr-1.5 flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13 2v7h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{file.title || file.name}</div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span className="truncate max-w-[100px]">{file.name}</span>
                        <span className="mx-1 text-[8px]">•</span>
                        <span>{file.pageCount}p</span>
                        <span className="mx-1 text-[8px]">•</span>
                        <span className="text-[10px]">{file.creationDate}</span>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <svg className="mx-auto" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 3a7 7 0 100 14 7 7 0 000-14zM3 10a7 7 0 1114 0 7 7 0 01-14 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 21l-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="mt-2">No files found matching "{searchQuery}"</p>
                    <button 
                      className="mt-2 text-primary text-sm hover:underline"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <>
                    <svg className="mx-auto" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor"/>
                    </svg>
                    <p className="mt-2">No files available. Please upload some PDFs first.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Overlay when sidebar is open */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}