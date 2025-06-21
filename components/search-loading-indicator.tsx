import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface SearchLoadingIndicatorProps {
  isSearching: boolean;
  searchType: 'fulltext' | 'vector' | 'hybrid';
  query: string;
}

export function SearchLoadingIndicator({ 
  isSearching, 
  searchType,
  query 
}: SearchLoadingIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  
  // Reset progress when search starts
  useEffect(() => {
    if (isSearching) {
      setProgress(0);
      setTimeElapsed(0);
      setEstimatedTime(getEstimatedTime(searchType, query.length));
    }
  }, [isSearching, searchType, query]);
  
  // Simulate progress based on search type
  useEffect(() => {
    if (!isSearching) return;
    
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 0.1);
      
      setProgress(prev => {
        // Different progress curves based on search type
        if (searchType === 'vector' || searchType === 'hybrid') {
          // Vector and hybrid searches typically take longer
          return Math.min(prev + 1.5, 95);
        } else {
          // Fulltext search is usually faster
          return Math.min(prev + 3, 95);
        }
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [isSearching, searchType]);
  
  // Helper function to estimate search time based on search type and query length
  const getEstimatedTime = (type: string, queryLength: number): number => {
    switch (type) {
      case 'vector':
        return 2 + (queryLength * 0.05); // Vector search is slower
      case 'hybrid':
        return 2.5 + (queryLength * 0.07); // Hybrid is the slowest
      case 'fulltext':
      default:
        return 1 + (queryLength * 0.02); // Fulltext is fastest
    }
  };
  
  if (!isSearching) return null;
  
  return (
    <div className="w-full space-y-2 mt-2 mb-4 bg-muted/30 p-3 rounded-md border">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {searchType === 'fulltext' ? 'Searching text' : 
             searchType === 'vector' ? 'Semantic search in progress' : 
             'Hybrid search in progress'}
          </span>
        </div>
        <div>
          {timeElapsed.toFixed(1)}s 
          {estimatedTime && ` / ~${estimatedTime.toFixed(1)}s`}
        </div>
      </div>
      
      <Progress value={progress} className="h-1" />
      
      <div className="text-xs text-muted-foreground">
        {searchType === 'vector' && (
          <span>Generating embeddings and finding semantic matches...</span>
        )}
        {searchType === 'hybrid' && (
          <span>Combining semantic and keyword search for best results...</span>
        )}
        {searchType === 'fulltext' && (
          <span>Searching document text for keyword matches...</span>
        )}
      </div>
    </div>
  );
} 