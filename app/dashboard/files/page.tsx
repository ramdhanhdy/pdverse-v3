"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes, truncateFilename } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

type FileItem = {
  id: string;
  filename: string;
  original_filename: string;
  size: number;
  path: string;
  mimetype: string;
  created_at: number;
  updated_at: number;
};

export default function FilesPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"files" | "fulltext">("files");
  const [fulltextResults, setFulltextResults] = useState<Array<{
    chunk: {
      id: string;
      documentId: string;
      pageNumber: number;
      chunkIndex: number;
      content: string;
      contentType: string;
    },
    fileInfo: {
      id: string;
      filename: string;
      original_filename: string;
    }
  }>>([]);
  const [fulltextLoading, setFulltextLoading] = useState(false);

  // Fetch files from API
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/files");
        
        if (!response.ok) {
          throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Files API response:", data); // Debug log
        setFiles(Array.isArray(data) ? data : data.files || []);
      } catch (error) {
        console.error("Error fetching files:", error);
        toast.error("Failed to load files. Please try again.");
        setFiles([]); // Set empty array to prevent undefined errors
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setIsSearching(false);
      setFilteredFiles(files);
      return;
    }

    // Add a small delay to show the searching state
    setIsSearching(true);
    const searchTimeout = setTimeout(() => {
      const query = searchQuery.toLowerCase();
      const filtered = files.filter((file) => {
        // Search in filename
        if (file.original_filename.toLowerCase().includes(query)) {
          return true;
        }
        // Search in system filename
        if (file.filename.toLowerCase().includes(query)) {
          return true;
        }
        // Search in mimetype
        if (file.mimetype.toLowerCase().includes(query)) {
          return true;
        }
        
        return false;
      });
      
      setFilteredFiles(filtered);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [files, searchQuery]);

  const toggleFileSelection = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((fileId) => fileId !== id) : [...prev, id]
    );
  };

  const selectAllFiles = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredFiles.map((file) => file.id));
    }
  };

  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      // Delete each selected file
      for (const fileId of selectedFiles) {
        const response = await fetch(`/api/files?id=${fileId}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to delete file");
        }
      }
      
      // Update local state
      setFiles((prev) => prev.filter((file) => !selectedFiles.includes(file.id)));
      setSelectedFiles([]);
      
      toast.success(`${selectedFiles.length} file(s) deleted successfully`);
    } catch (error) {
      console.error("Error deleting files:", error);
      toast.error("Failed to delete some files. Please try again.");
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (activeTab === "files") {
      if (query.trim() === "") {
        setIsSearching(false);
        setFilteredFiles(files);
      } else {
        setIsSearching(true);
        const filtered = files.filter((file) =>
          file.original_filename.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredFiles(filtered);
      }
    }
  };

  const handleFullTextSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }
    
    try {
      setFulltextLoading(true);
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to search content: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setFulltextResults(data.results);
    } catch (error) {
      console.error("Error searching content:", error);
      toast.error("Failed to search document content. Please try again.");
    } finally {
      setFulltextLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "files" | "fulltext");
    if (value === "fulltext" && searchQuery.trim()) {
      handleFullTextSearch();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (activeTab === "fulltext") {
        handleFullTextSearch();
      }
    }
  };

  const displayedFiles = isSearching ? filteredFiles : files;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Your Files</h1>
            {searchQuery && (
              <div className="flex items-center bg-accent/50 rounded-full px-3 py-1 text-sm gap-1">
                <span>Search: {searchQuery}</span>
                {isSearching && (
                  <div className="w-3 h-3 rounded-full border-t-2 border-primary animate-spin mr-1"></div>
                )}
                <button 
                  onClick={() => setSearchQuery("")}
                  className="hover:text-primary"
                  aria-label="Clear search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M18 6 6 18"></path>
                    <path d="m6 6 12 12"></path>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="files" onValueChange={handleTabChange} className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="fulltext">Full-Text Search</TabsTrigger>
        </TabsList>

        <div className="flex items-center mb-6 space-x-2">
          <div className="relative flex-1">
            <Input
              type="search"
              placeholder={activeTab === "files" ? "Search files by name..." : "Search document content..."}
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              className="pl-10"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          {activeTab === "fulltext" && (
            <Button 
              onClick={handleFullTextSearch} 
              disabled={fulltextLoading || !searchQuery.trim()}
            >
              {fulltextLoading ? "Searching..." : "Search"}
            </Button>
          )}
        </div>

        <TabsContent value="files">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </Button>
                      </div>
                      <div className="aspect-[3/4] bg-accent/50 flex items-center justify-center">
                        <Skeleton className="h-16 w-16" />
                      </div>
                      <div className="p-4 border-t">
                        <Skeleton className="h-4 w-1/3 mb-2" />
                        <Skeleton className="h-4 w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : displayedFiles.length === 0 ? (
            <div className="text-center py-16 bg-muted/20 rounded-lg">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-10 w-10 text-muted-foreground"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-3">No files found</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery.trim()
                  ? "No files matching your search. Try a different query."
                  : "No files uploaded yet. Upload your first PDF to get started."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayedFiles.map((file) => (
                <Card
                  key={file.id}
                  className={`overflow-hidden hover:shadow-md transition-shadow ${
                    selectedFiles.includes(file.id) ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFileSelection(file.id);
                          }}
                        >
                          {selectedFiles.includes(file.id) ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <rect width="18" height="18" x="3" y="3" rx="2" />
                            </svg>
                          )}
                        </Button>
                      </div>
                      <Link href={`/dashboard/files/${file.id}`}>
                        <div className="aspect-[3/4] bg-accent/50 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-16 w-16 text-muted-foreground"
                          >
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="p-4 border-t">
                          <div className="font-medium truncate">
                            {truncateFilename(file.original_filename)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 flex justify-between">
                            <span>{formatBytes(file.size)}</span>
                            <span>{new Date(file.updated_at * 1000).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fulltext">
          {fulltextLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="p-4 border-t">
                        <Skeleton className="h-4 w-1/3 mb-2" />
                        <Skeleton className="h-16 w-full mb-2" />
                        <Skeleton className="h-4 w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : fulltextResults.length === 0 ? (
            <div className="text-center py-16 bg-muted/20 rounded-lg">
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery.trim() 
                  ? "No search results found. Try a different query."
                  : "Enter a search term to find content in your documents."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {fulltextResults.map((result, index) => (
                <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="p-4 border-t">
                        <div className="mb-2">
                          <Link 
                            href={`/dashboard/files/${result.fileInfo.id}`}
                            className="text-primary font-medium hover:underline"
                          >
                            {result.fileInfo.original_filename}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Page {result.chunk.pageNumber + 1}, Section {result.chunk.chunkIndex + 1}
                          </p>
                        </div>
                        <p className="text-sm">
                          {highlightSearchTerm(result.chunk.content, searchQuery)}
                        </p>
                        <div className="mt-2 flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            asChild
                          >
                            <Link href={`/dashboard/files/${result.fileInfo.id}?page=${result.chunk.pageNumber + 1}`}>
                              View in Document
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllFiles}
          >
            {selectedFiles.length === filteredFiles.length && filteredFiles.length > 0
              ? "Deselect All"
              : "Select All"}
          </Button>
          {selectedFiles.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelectedFiles}
            >
              Delete Selected
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredFiles.length} {filteredFiles.length === 1 ? "file" : "files"}
        </div>
      </div>
    </div>
  );
}

// Helper function to highlight search terms in text
function highlightSearchTerm(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">{part}</mark> 
          : part
      )}
    </>
  );
}
