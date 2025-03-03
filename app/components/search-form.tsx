import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { searchDocumentsInPythonBackend } from "@/lib/python-backend";

interface SearchFormProps {
  onSearch: (results: any[]) => void;
}

export function SearchForm({ onSearch }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<'fulltext' | 'vector' | 'hybrid'>("fulltext"); // Typed union
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const { results } = await searchDocumentsInPythonBackend(query, { search_type: searchType }); // Updated to snake_case

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

      onSearch(transformedResults);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex gap-2 items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter search query..."
          className="flex-1"
        />
        <Select value={searchType} onValueChange={(v) => setSearchType(v as 'fulltext' | 'vector' | 'hybrid')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Search type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fulltext">Full Text</SelectItem>
            <SelectItem value="vector">Semantic</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </div>
    </div>
  );
}