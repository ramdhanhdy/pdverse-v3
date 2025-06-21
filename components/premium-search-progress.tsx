import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface PremiumSearchProgressProps {
  isSearching: boolean;
  searchType: 'fulltext' | 'vector' | 'hybrid';
  query: string;
  className?: string;
}

export function PremiumSearchProgress({
  isSearching,
  searchType,
  query,
  className = '',
}: PremiumSearchProgressProps) {
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [pulseColors, setPulseColors] = useState<string[]>([]);
  
  // Reset progress when search starts
  useEffect(() => {
    if (isSearching) {
      setProgress(0);
      setTimeElapsed(0);
      setEstimatedTime(getEstimatedTime(searchType, query.length));
      
      // Set pulse colors based on search type
      if (searchType === 'fulltext') {
        setPulseColors(['#a5b4fc', '#818cf8', '#6366f1']); // Indigo shades
      } else if (searchType === 'vector') {
        setPulseColors(['#93c5fd', '#60a5fa', '#3b82f6']); // Blue shades
      } else {
        setPulseColors(['#c4b5fd', '#a78bfa', '#8b5cf6']); // Purple shades
      }
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
    <AnimatePresence>
      <motion.div 
        className={`w-full rounded-lg overflow-hidden bg-background border shadow-sm ${className}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <motion.div 
                className="relative w-8 h-8 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, ease: "linear", repeat: Infinity }}
              >
                <motion.div 
                  className="absolute inset-0 rounded-full"
                  style={{ 
                    background: `conic-gradient(from 0deg, ${pulseColors[0]} 0%, ${pulseColors[1]} 50%, ${pulseColors[2]} 100%)`,
                    filter: "blur(1px)"
                  }}
                  animate={{ 
                    rotate: [0, 360],
                    scale: [0.85, 1, 0.85]
                  }}
                  transition={{ 
                    rotate: { duration: 10, ease: "linear", repeat: Infinity },
                    scale: { duration: 3, ease: "easeInOut", repeat: Infinity }
                  }}
                />
                <div className="absolute inset-1 bg-background rounded-full"></div>
                <Loader2 className="w-4 h-4 text-foreground/80 relative z-10" />
              </motion.div>
              
              <div>
                <h3 className="font-medium text-lg">
                  {searchType === 'fulltext' ? 'Text Search' : 
                   searchType === 'vector' ? 'Semantic Search' : 
                   'Hybrid Search'}
                </h3>
                <p className="text-sm text-muted-foreground">Searching for "{query}"</p>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              {timeElapsed.toFixed(1)}s {estimatedTime && `/ ~${estimatedTime.toFixed(1)}s`}
            </div>
          </div>
          
          <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden mb-4">
            <motion.div 
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ 
                background: `linear-gradient(to right, ${pulseColors[0]}, ${pulseColors[2]})`,
                width: `${progress}%` 
              }}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
            
            {/* Animated pulse effect */}
            <motion.div 
              className="absolute inset-y-0 rounded-full w-20 opacity-50"
              style={{ 
                background: `linear-gradient(to right, transparent, ${pulseColors[1]}, transparent)`,
                left: `${progress - 10}%` 
              }}
              animate={{ 
                left: [`${progress - 20}%`, `${progress + 5}%`],
                opacity: [0.3, 0.7, 0.3]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                className="h-1 bg-muted/30 rounded-full overflow-hidden"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ 
                  duration: 2 + i, 
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeInOut"
                }}
              >
                <motion.div 
                  className="h-full rounded-full"
                  style={{ 
                    background: `linear-gradient(to right, ${pulseColors[0]}, ${pulseColors[2]})`,
                  }}
                  animate={{ 
                    x: ["-100%", "100%"]
                  }}
                  transition={{ 
                    duration: 3 + i * 2, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
            ))}
          </div>
          
          <div className="mt-4 text-sm text-muted-foreground">
            {searchType === 'vector' && (
              <p>Creating semantic embeddings and finding conceptual matches in your documents...</p>
            )}
            {searchType === 'hybrid' && (
              <p>Combining semantic understanding with keyword matching for comprehensive results...</p>
            )}
            {searchType === 'fulltext' && (
              <p>Scanning document text for exact keyword matches and relevant content...</p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
} 