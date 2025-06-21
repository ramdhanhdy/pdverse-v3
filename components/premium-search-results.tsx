import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Clock, FileText, Search } from 'lucide-react';

interface PremiumSearchResultsProps {
  results: Array<{
    chunk: {
      id: string;
      documentId: string;
      pageNumber: number;
      content: string;
    },
    fileInfo: {
      id: string;
      filename: string;
      original_filename: string;
      author?: string;
    },
    score: number;
  }>;
  searchQuery: string;
  searchType: 'fulltext' | 'vector' | 'hybrid';
  searchTime: number;
}

export function PremiumSearchResults({
  results,
  searchQuery,
  searchType,
  searchTime
}: PremiumSearchResultsProps) {
  if (results.length === 0) {
    return (
      <motion.div 
        className="text-center py-16 bg-muted/20 rounded-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
          <Search className="h-10 w-10 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {searchQuery.trim() 
            ? "No search results found. Try a different query."
            : "Enter a search term to find content in your documents."}
        </p>
        {searchQuery.trim() && (
          <div className="max-w-md mx-auto text-sm text-muted-foreground">
            <p className="mb-2">Suggestions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check for spelling errors</li>
              <li>Try more general keywords</li>
              <li>Try a different search type (Fulltext, Semantic, or Hybrid)</li>
              <li>Use shorter, more specific phrases</li>
            </ul>
          </div>
        )}
      </motion.div>
    );
  }

  // Function to highlight search terms in content
  const highlightSearchTerms = (content: string, searchTerms: string): React.ReactNode => {
    if (!searchTerms.trim()) return content;
    
    const parts = content.split(new RegExp(`(${searchTerms})`, 'gi'));
    
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === searchTerms.toLowerCase() 
            ? <mark key={i} className="bg-yellow-100 dark:bg-yellow-800/30 px-0.5 rounded">{part}</mark> 
            : part
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <motion.div 
        className="flex items-center justify-between mb-4 px-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-sm">
          <span className="font-medium">{results.length}</span> results for 
          <span className="font-medium italic mx-1">"{searchQuery}"</span>
          using <span className="font-medium">{searchType}</span> search
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Search completed in {searchTime.toFixed(2)}s
        </div>
      </motion.div>
      
      {results.map((result, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.05 }}
        >
          <Card className="overflow-hidden hover:shadow-md transition-shadow border-l-4" 
                style={{ 
                  borderLeftColor: searchType === 'fulltext' 
                    ? '#6366f1' // Indigo for fulltext
                    : searchType === 'vector' 
                      ? '#3b82f6' // Blue for vector
                      : '#8b5cf6' // Purple for hybrid
                }}>
            <CardContent className="p-0">
              <div className="relative">
                <div className="p-4">
                  <div className="mb-2">
                    <Link 
                      href={`/dashboard/files/${result.fileInfo.id}`}
                      className="text-primary font-medium hover:underline flex items-center gap-1"
                    >
                      <FileText className="h-4 w-4" />
                      {result.fileInfo.original_filename}
                    </Link>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2 items-center">
                        <p className="text-xs text-muted-foreground">
                          {result.fileInfo.author ? `${result.fileInfo.author} • ` : ''}
                          Page {result.chunk.pageNumber + 1}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ 
                                backgroundColor: searchType === 'fulltext' 
                                  ? 'rgba(99, 102, 241, 0.1)' // Indigo bg
                                  : searchType === 'vector' 
                                    ? 'rgba(59, 130, 246, 0.1)' // Blue bg
                                    : 'rgba(139, 92, 246, 0.1)', // Purple bg
                                color: searchType === 'fulltext' 
                                  ? '#6366f1' // Indigo text
                                  : searchType === 'vector' 
                                    ? '#3b82f6' // Blue text
                                    : '#8b5cf6' // Purple text
                              }}>
                          {searchType === 'hybrid' ? 'Hybrid' : 
                           searchType === 'vector' ? 'Semantic' : 'Text'}
                        </span>
                      </div>
                      <div className="text-xs font-medium"
                           style={{ 
                             color: searchType === 'fulltext' 
                               ? '#6366f1' // Indigo
                               : searchType === 'vector' 
                                 ? '#3b82f6' // Blue
                                 : '#8b5cf6' // Purple
                           }}>
                        {typeof result.score === 'number' ? 
                         `${(result.score * 100).toFixed(1)}% Match` : 
                         result.score}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-4 mb-2">
                    {highlightSearchTerms(result.chunk.content, searchQuery)}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <Link href={`/dashboard/files/${result.fileInfo.id}?page=${result.chunk.pageNumber + 1}`}>
                        View Document
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
} 