"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes, truncateFilename } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Your Files</h1>
            {searchQuery && (
              <div className="flex items-center bg-accent/50 rounded-full px-3 py-1 text-sm gap-1">
                <span>Search: {searchQuery}</span>
                {isSearching && (
                  <div className="w-3 h-3 rounded-full border-t-2 border-primary animate-spin mr-1"></div>
                )}
                <button 
                  onClick={clearSearch}
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

      <div className="mb-6">
        <form onSubmit={handleSearch} className="w-full flex gap-2 items-center">
          <div className="relative flex-1 max-w-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              type="search"
              placeholder="Search files by name..."
              className="pl-10 pr-10 w-full focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </button>
            )}
          </div>
          <Link href="/dashboard/files/upload">
            <Button>Upload</Button>
          </Link>
        </form>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setView("grid")}
              className={view === "grid" ? "bg-accent" : ""}
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
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <span className="sr-only">Grid view</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setView("list")}
              className={view === "list" ? "bg-accent" : ""}
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
                <line x1="8" x2="21" y1="6" y2="6" />
                <line x1="8" x2="21" y1="12" y2="12" />
                <line x1="8" x2="21" y1="18" y2="18" />
                <line x1="3" x2="3" y1="6" y2="6" />
                <line x1="3" x2="3" y1="12" y2="12" />
                <line x1="3" x2="3" y1="18" y2="18" />
              </svg>
              <span className="sr-only">List view</span>
            </Button>
          </div>
        </div>
      </div>

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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-4xl">📄</div>
          {searchQuery ? (
            <>
              <h3 className="text-xl font-semibold">No matching files</h3>
              <p className="text-center text-muted-foreground max-w-md">
                No files match your search term "{searchQuery}". Try a different search or upload a new file.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold">No files yet</h3>
              <p className="text-center text-muted-foreground max-w-md">
                Upload your first file to get started.
              </p>
            </>
          )}
          <Button onClick={() => window.location.href = "/dashboard/upload"}>
            Upload Files
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <Card
              key={file.id}
              className={`overflow-hidden ${
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
                    <div className="aspect-[3/4] bg-accent flex items-center justify-center">
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
                    <div className="p-3">
                      <div className="font-medium truncate">
                        {truncateFilename(file.original_filename)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatBytes(file.size)} • {new Date(file.updated_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className={`flex items-center p-3 hover:bg-accent ${
                selectedFiles.includes(file.id) ? "bg-accent" : ""
              }`}
            >
              <div className="mr-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
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
                      className="h-3 w-3"
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
                      className="h-3 w-3"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                    </svg>
                  )}
                </Button>
              </div>
              <Link
                href={`/dashboard/files/${file.id}`}
                className="flex-1 flex items-center"
              >
                <div className="mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-muted-foreground"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.original_filename}</div>
                </div>
                <div className="ml-4 text-sm text-muted-foreground">
                  {formatBytes(file.size)}
                </div>
                <div className="ml-4 text-sm text-muted-foreground">
                  {new Date(file.updated_at * 1000).toLocaleDateString()}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
