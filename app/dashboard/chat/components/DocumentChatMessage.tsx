import React, { useState } from 'react';
import { FileText, Book, Layers, Info, X, ExternalLink, Copy, ChevronDown, FileIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DocumentChatMessageProps {
  content: string;
  isUser: boolean;
  documentInfo?: DocumentInfo[];
}

interface DocumentInfo {
  id: string;
  title: string;
  filename?: string;
  pageCount?: number;
}

export function DocumentChatMessage({ content, isUser, documentInfo = [] }: DocumentChatMessageProps) {
  const [expandedCitation, setExpandedCitation] = useState<{docId?: string, title: string} | null>(null);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [showAllCitations, setShowAllCitations] = useState(false);

  // Handle copying citation to clipboard
  const handleCopyCitation = (citation: string, docTitle?: string) => {
    const citationText = docTitle 
      ? `Citation from "${citation}" in document "${docTitle}"`
      : `Citation from "${citation}"`;
    
    navigator.clipboard.writeText(citationText);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  // If it's a user message, just display it normally
  if (isUser) {
    return (
      <div className="whitespace-pre-wrap">{content}</div>
    );
  }

  // For assistant messages, enhance with document references and formatting
  const formattedContent = formatDocumentReferences(content);
  
  // Check if there are any citations in the content
  const hasCitations = formattedContent.some(part => part.type !== 'text');
  
  // Group citations by document if possible
  const documentCitations = new Map<string, {doc?: DocumentInfo, citations: string[]}>();
  
  // Try to match citations with document info
  formattedContent.forEach(part => {
    if (part.type === 'document') {
      // Try to find matching document
      const matchedDoc = documentInfo.find(doc => 
        doc.title.toLowerCase().includes(part.content.toLowerCase()) || 
        part.content.toLowerCase().includes(doc.title.toLowerCase())
      );
      
      const docKey = matchedDoc?.id || part.content;
      
      if (!documentCitations.has(docKey)) {
        documentCitations.set(docKey, {
          doc: matchedDoc,
          citations: [part.content]
        });
      } else if (!documentCitations.get(docKey)?.citations.includes(part.content)) {
        documentCitations.get(docKey)?.citations.push(part.content);
      }
    }
  });
  
  // Count total citations
  const totalCitations = Array.from(documentCitations.values())
    .reduce((sum, item) => sum + item.citations.length, 0);
  
  // Get document color based on index (for consistent coloring)
  const getDocumentColor = (index: number) => {
    const colors = [
      'green', 'blue', 'purple', 'amber', 'rose', 'cyan', 'indigo', 'emerald'
    ];
    return colors[index % colors.length];
  };
  
  // Get badge styles based on document color
  const getDocumentBadgeStyles = (color: string) => {
    const styles: Record<string, Record<string, string>> = {
      green: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
        hover: 'hover:bg-green-200 dark:hover:bg-green-800/40'
      },
      blue: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
        hover: 'hover:bg-blue-200 dark:hover:bg-blue-800/40'
      },
      purple: {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-200 dark:border-purple-800',
        hover: 'hover:bg-purple-200 dark:hover:bg-purple-800/40'
      },
      amber: {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        hover: 'hover:bg-amber-200 dark:hover:bg-amber-800/40'
      },
      rose: {
        bg: 'bg-rose-100 dark:bg-rose-900/30',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800',
        hover: 'hover:bg-rose-200 dark:hover:bg-rose-800/40'
      },
      cyan: {
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
        text: 'text-cyan-700 dark:text-cyan-300',
        border: 'border-cyan-200 dark:border-cyan-800',
        hover: 'hover:bg-cyan-200 dark:hover:bg-cyan-800/40'
      },
      indigo: {
        bg: 'bg-indigo-100 dark:bg-indigo-900/30',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-200 dark:border-indigo-800',
        hover: 'hover:bg-indigo-200 dark:hover:bg-indigo-800/40'
      },
      emerald: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
        hover: 'hover:bg-emerald-200 dark:hover:bg-emerald-800/40'
      }
    };
    
    return styles[color] || styles.blue;
  };
  
  // Find document color for a specific citation
  const findDocumentColorForCitation = (citation: string) => {
    let docIndex = 0;
    let foundDoc = '';
    
    for (const [docKey, info] of Array.from(documentCitations.entries())) {
      if (info.citations.includes(citation)) {
        foundDoc = docKey;
        break;
      }
      docIndex++;
    }
    
    return getDocumentColor(docIndex);
  };
  
  return (
    <div className="document-chat-message space-y-2">
      <div className="whitespace-pre-wrap">
        {formattedContent.map((part, index) => {
          if (part.type === 'text') {
            return <span key={index}>{part.content}</span>;
          } else if (part.type === 'document') {
            // Find which document this citation belongs to
            const docColor = findDocumentColorForCitation(part.content);
            const styles = getDocumentBadgeStyles(docColor);
            
            // Find matching document info if available
            let matchedDoc: DocumentInfo | undefined;
            for (const [_, info] of Array.from(documentCitations.entries())) {
              if (info.citations.includes(part.content) && info.doc) {
                matchedDoc = info.doc;
                break;
              }
            }
            
            return (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className={`mx-1 ${styles.bg} ${styles.text} ${styles.border} ${styles.hover} cursor-pointer transition-colors font-medium`}
                      onClick={() => setExpandedCitation({
                        docId: matchedDoc?.id,
                        title: part.content
                      })}
                    >
                      <Book className="h-3 w-3 mr-1" />
                      {part.content}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Click to view document details</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          } else if (part.type === 'page') {
            return (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="mx-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-800/40 cursor-pointer transition-colors font-medium"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Page {part.content}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Page {part.content} of the document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          } else if (part.type === 'section') {
            return (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="mx-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-800/40 cursor-pointer transition-colors font-medium"
                    >
                      <Layers className="h-3 w-3 mr-1" />
                      {part.content}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Section: {part.content}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          return null;
        })}
      </div>

      {/* Citation footer - only show if there are citations */}
      {hasCitations && !expandedCitation && documentCitations.size > 0 && (
        <div className="flex flex-col mt-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/40 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>Citations from {documentCitations.size > 1 ? `${documentCitations.size} documents` : 'your document'}</span>
            </div>
            {documentCitations.size > 1 && (
              <button 
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setShowAllCitations(!showAllCitations)}
              >
                {showAllCitations ? 'Hide sources' : 'Show all sources'}
                <ChevronDown className={`h-3 w-3 transition-transform ${showAllCitations ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          
          {/* Document source list */}
          {showAllCitations && (
            <div className="grid gap-1 mt-1 p-2 bg-muted/20 rounded-md text-xs">
              {Array.from(documentCitations.entries()).map(([docKey, info], index) => {
                const color = getDocumentColor(index);
                const styles = getDocumentBadgeStyles(color);
                
                return (
                  <div key={docKey} className="flex items-center gap-2">
                    <div className={`${styles.bg} p-1 rounded-md ${styles.text}`}>
                      <FileIcon className="h-3 w-3" />
                    </div>
                    <span className="font-medium">{info.doc?.title || info.citations[0]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Expanded citation card */}
      {expandedCitation && (
        <div className="mt-3 p-3 bg-card border rounded-lg relative shadow-sm">
          <button 
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50"
            onClick={() => setExpandedCitation(null)}
          >
            <X className="h-3 w-3" />
          </button>
          
          <div className="flex items-start gap-3">
            {/* Find the document color for this citation */}
            {(() => {
              let docIndex = 0;
              let matchedDoc: DocumentInfo | undefined;
              
              for (const [docKey, info] of Array.from(documentCitations.entries())) {
                if (info.citations.includes(expandedCitation.title)) {
                  matchedDoc = info.doc;
                  break;
                }
                docIndex++;
              }
              
              const color = getDocumentColor(docIndex);
              const styles = getDocumentBadgeStyles(color);
              
              return (
                <>
                  <div className={`${styles.bg} p-2 rounded-md`}>
                    <Book className={`h-5 w-5 ${styles.text}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{expandedCitation.title}</h4>
                    {matchedDoc && (
                      <p className="text-xs text-muted-foreground">
                        From: {matchedDoc.title}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      This information is cited from {documentCitations.size > 1 ? 'one of the documents' : 'the document'} you provided.
                    </p>
                    
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>PDF Document</span>
                      </div>
                      {matchedDoc?.pageCount && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Layers className="h-3 w-3" />
                          <span>{matchedDoc.pageCount} pages</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                      <button className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        <ExternalLink className="h-3 w-3" />
                        View in document
                      </button>
                      <button 
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleCopyCitation(expandedCitation.title, matchedDoc?.title)}
                      >
                        <Copy className="h-3 w-3" />
                        {copiedCitation ? "Copied!" : "Copy citation"}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format document references in the text
function formatDocumentReferences(text: string) {
  const parts: Array<{
    type: 'text' | 'document' | 'page' | 'section';
    content: string;
  }> = [];
  
  // Enhanced regular expressions to match document references
  const documentRegex = /(?:"([^"]+)"|'([^']+)'|in\s+([^,.]+)(?:\s+document|\s+file))/g; // Match document titles in quotes or after "in"
  const pageRegex = /\b(?:Page|page|p\.|pg\.)\s*(\d+)(?:-(\d+))?\b/g; // Match page references with ranges
  const sectionRegex = /\b(?:Section|section|Chapter|chapter|Sec\.|Ch\.|Part|part)\s+([^,.;:]+)/g; // Match section references
  
  // Process the text to find all matches
  let processedText = text;
  let allMatches: Array<{
    type: 'text' | 'document' | 'page' | 'section';
    content: string;
    index: number;
    length: number;
  }> = [];
  
  // Find document references
  let docMatch;
  while ((docMatch = documentRegex.exec(text)) !== null) {
    const title = docMatch[1] || docMatch[2] || docMatch[3]; // Get the matched group
    if (title) {
      allMatches.push({
        type: 'document',
        content: title,
        index: docMatch.index,
        length: docMatch[0].length
      });
    }
  }
  
  // Find page references
  let pageMatch;
  while ((pageMatch = pageRegex.exec(text)) !== null) {
    const pageNum = pageMatch[1];
    const pageRange = pageMatch[2] ? `-${pageMatch[2]}` : '';
    allMatches.push({
      type: 'page',
      content: pageNum + pageRange,
      index: pageMatch.index,
      length: pageMatch[0].length
    });
  }
  
  // Find section references
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(text)) !== null) {
    allMatches.push({
      type: 'section',
      content: sectionMatch[1],
      index: sectionMatch.index,
      length: sectionMatch[0].length
    });
  }
  
  // Sort matches by their position in the text
  allMatches.sort((a, b) => a.index - b.index);
  
  // Build the parts array
  let lastIndex = 0;
  for (const match of allMatches) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // Add the match
    parts.push({
      type: match.type,
      content: match.content
    });
    
    lastIndex = match.index + match.length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

// Example usage:
/*
<DocumentChatMessage 
  content="The contact person for enquiries related to the Supply Chain Management aspects of the tender is Mr. Abri Adonis. You can reach him at Tel: 022 701 6922 or via e-mail at abri.adonis@sbm.gov.za. For enquiries regarding the specifications, you can contact Cassie du Preez via e-mail at cassie.dupreez@sbm.gov.za. (Page 10, 1.2.22)"
  isUser={false}
  documentInfo={[
    { id: "doc1", title: "Tender Document", pageCount: 45 },
    { id: "doc2", title: "Technical Specifications", pageCount: 22 }
  ]}
/>
*/ 