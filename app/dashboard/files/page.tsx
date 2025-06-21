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
import { Search, Upload } from "lucide-react";
import { searchDocumentsInPythonBackend } from "@/lib/python-backend";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumSearchProgress } from "@/components/premium-search-progress";
import { FileLoadingProgress } from "@/components/file-loading-progress";
import { PremiumSearchResults } from "@/components/premium-search-results";

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
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDisplayingSearchResults, setIsDisplayingSearchResults] = useState(false);
  const [fulltextResults, setFulltextResults] = useState<Array<{
    chunk: {
      id: string;
      documentId: string;
      pageNumber: number;
      chunkIndex: number;
      content: string;
      contentType: string;
    };
    fileInfo: {
      id: string;
      filename: string;
      original_filename: string;
      author: string;
    };
    score: number;
  }>>([]);
  const [fulltextLoading, setFulltextLoading] = useState(false);
  const [searchType, setSearchType] = useState<'hybrid' | 'vector' | 'fulltext'>('hybrid');
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/files');
        if (!response.ok) {
          throw new Error(`Failed to fetch files: ${response.statusText}`);
        }
        const data = await response.json();
        const filesData = data.files || [];
        const mappedFiles = filesData.map((doc: any) => ({
          id: doc.id,
          filename: doc.filename || doc.title,
          original_filename: doc.title,
          size: doc.file_size || 0,
          mimetype: 'application/pdf',
          created_at: new Date(doc.creation_date || Date.now()).getTime() / 1000,
          updated_at: new Date(doc.modification_date || Date.now()).getTime() / 1000,
        }));
        setFiles(mappedFiles);
      } catch (error) {
        console.error('Error fetching files:', error);
        toast.error('Failed to load files. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const toggleFileSelection = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((fileId) => fileId !== id) : [...prev, id]
    );
  };

  const selectAllFiles = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map((file) => file.id));
    }
  };

  const deleteSelectedFiles = async () => {
    const promise = fetch('/api/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_ids: selectedFiles }),
    });

    toast.promise(promise, {
      loading: 'Deleting files...',
      success: async (res) => {
        if (res.ok) {
          setFiles((prev) => prev.filter((file) => !selectedFiles.includes(file.id)));
          setSelectedFiles([]);
          return 'Selected files deleted successfully.';
        } else {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to delete files.');
        }
      },
      error: (err) => err.message,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleFullTextSearch = async () => {
    if (!searchQuery.trim()) return;
    setFulltextLoading(true);
    setSearchStartTime(Date.now());
    setIsDisplayingSearchResults(true);
    try {
      const searchResults = await searchDocumentsInPythonBackend(searchQuery, {
        search_type: searchType,
      });
      const transformedResults = searchResults.results.map((result: any) => ({
        chunk: {
          id: result.chunk_id,
          documentId: result.document_id,
          pageNumber: result.page_number || 1,
          chunkIndex: 0,
          content: result.content,
          contentType: 'text',
        },
        fileInfo: {
          id: result.document_id,
          filename: result.document_info?.title || 'Unknown',
          original_filename: result.document_info?.title || 'Unknown',
          author: result.document_info?.author || 'Unknown',
        },
        score: result.score,
      }));
      setFulltextResults(transformedResults);
    } catch (error: any) {
      console.error("Error during full-text search:", error);
      toast.error(`An error occurred during search: ${error.message}`);
      setFulltextResults([]);
    } finally {
      setFulltextLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFullTextSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setFulltextResults([]);
    setIsDisplayingSearchResults(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Your Files</h1>
      </div>

      <div className="flex items-center mb-6 space-x-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search document content..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            className="flex-1"
          />
        </div>
        <Select value={searchType} onValueChange={(value) => setSearchType(value as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select search type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hybrid">Hybrid Search</SelectItem>
            <SelectItem value="vector">Vector Search</SelectItem>
            <SelectItem value="fulltext">Full-text Search</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleFullTextSearch} disabled={fulltextLoading || !searchQuery}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        {isDisplayingSearchResults && (
          <Button variant="outline" onClick={clearSearch}>Clear</Button>
        )}
      </div>

      {!isDisplayingSearchResults && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllFiles}
              disabled={files.length === 0}
            >
              {selectedFiles.length === files.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {files.length} {files.length === 1 ? "file" : "files"}
          </div>
        </div>
      )}

      {isDisplayingSearchResults ? (
        fulltextLoading ? (
          <div className="space-y-4">
            <PremiumSearchProgress
              isSearching={fulltextLoading}
              searchType={searchType}
              query={searchQuery}
              className="mb-6"
            />
            {[...Array(4)].map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-1/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <PremiumSearchResults
            results={fulltextResults}
            searchQuery={searchQuery}
            searchType={searchType}
            searchTime={(Date.now() - (searchStartTime || Date.now())) / 1000}
          />
        )
      ) : (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <Card key={index}><CardContent className="p-4"><Skeleton className="h-32" /></CardContent></Card>
            ))}
          </div>
        ) : files.length === 0 ? (
          <FileLoadingProgress isLoading={loading} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {files.map((file) => (
              <Card key={file.id} className={`overflow-hidden hover:shadow-md transition-shadow ${selectedFiles.includes(file.id) ? "ring-2 ring-primary" : ""}`}>
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
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                          </svg>
                        )}
                      </Button>
                    </div>
                    <Link href={`/dashboard/files/${file.id}`} className="block">
                      <div className="aspect-video bg-muted flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                      </div>
                      <div className="p-4 border-t">
                        <div className="font-medium truncate">{truncateFilename(file.original_filename)}</div>
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
        )
      )}



      {!isDisplayingSearchResults && (
        <Button asChild className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg z-20">
          <Link href="/dashboard/files/upload" aria-label="Upload File">
            <Upload className="h-8 w-8" />
          </Link>
        </Button>
      )}
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
