import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { searchDocumentsInPythonBackend } from "@/lib/python-backend";
import { PremiumSearchProgress } from "@/components/premium-search-progress";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";

interface SearchFormProps {
  onSearch: (results: any[]) => void;
  initialQuery?: string;
  initialSearchType?: 'fulltext' | 'vector' | 'hybrid';
}

export function SearchForm({ 
  onSearch, 
  initialQuery = "", 
  initialSearchType = "fulltext" 
}: SearchFormProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<'fulltext' | 'vector' | 'hybrid'>(initialSearchType);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      try {
        setRecentSearches(JSON.parse(savedSearches));
      } catch (e) {
        console.error('Failed to parse recent searches', e);
      }
    }
  }, []);

  // Save a search to recent searches
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updatedSearches = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 5); // Keep only the 5 most recent searches
    
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }
    
    setIsSearching(true);
    setSearchStartTime(Date.now());
    
    try {
      const { results } = await searchDocumentsInPythonBackend(query, { 
        search_type: searchType,
        limit: 20 // Increase limit for better results
      });

      const transformedResults = results.map((r: any) => ({
        chunk: {
          id: r.chunk_id,
          documentId: r.document_id,
          pageNumber: r.page_number,
          content: r.content
        },
        fileInfo: {
          id: r.document_id,
          filename: r.document_info.title,
          original_filename: r.document_info.title
        },
        score: r.score
      }));

      // Save this search to recent searches
      saveRecentSearch(query);
      
      // Calculate and log search time
      const searchTime = (Date.now() - (searchStartTime || Date.now())) / 1000;
      console.log(`Search completed in ${searchTime.toFixed(2)}s`);
      
      // Show toast with search stats
      toast.success(`Found ${transformedResults.length} results in ${searchTime.toFixed(1)}s`);
      
      onSearch(transformedResults);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
      setSearchStartTime(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter search query..."
            className="flex-1 pl-9"
            disabled={isSearching}
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        
        <Select 
          value={searchType} 
          onValueChange={(v) => setSearchType(v as 'fulltext' | 'vector' | 'hybrid')}
          disabled={isSearching}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Search type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fulltext">Full Text</SelectItem>
            <SelectItem value="vector">Semantic</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
        
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !query.trim()}
          className="min-w-[100px]"
        >
          {isSearching ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching
            </span>
          ) : "Search"}
        </Button>
      </div>
      
      {/* Recent searches */}
      {!isSearching && recentSearches.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Recent:</span>
          {recentSearches.map((recentQuery, index) => (
            <button
              key={index}
              onClick={() => {
                setQuery(recentQuery);
                // Optional: auto-search when clicking a recent search
                // setTimeout(handleSearch, 0);
              }}
              className="text-xs px-2 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors"
            >
              {recentQuery}
            </button>
          ))}
        </div>
      )}
      
      {/* Premium search progress visualization */}
      <PremiumSearchProgress 
        isSearching={isSearching} 
        searchType={searchType}
        query={query}
        className="mt-4"
      />
    </div>
  );
}