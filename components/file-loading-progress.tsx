import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Loader2 } from 'lucide-react';

interface FileLoadingProgressProps {
  isLoading: boolean;
  className?: string;
}

export function FileLoadingProgress({
  isLoading,
  className = '',
}: FileLoadingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // Reset progress when loading starts
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      setTimeElapsed(0);
    }
  }, [isLoading]);
  
  // Simulate progress
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 0.1);
      
      setProgress(prev => {
        // Simulate a realistic loading curve
        if (prev < 30) {
          return prev + 2; // Fast at first
        } else if (prev < 70) {
          return prev + 1; // Slower in the middle
        } else {
          return Math.min(prev + 0.5, 95); // Very slow at the end
        }
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [isLoading]);
  
  if (!isLoading) return null;
  
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
                    background: `conic-gradient(from 0deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%)`,
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
                <FileText className="w-4 h-4 text-foreground/80 relative z-10" />
              </motion.div>
              
              <div>
                <h3 className="font-medium text-lg">Loading Files</h3>
                <p className="text-sm text-muted-foreground">Retrieving your document library</p>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              {timeElapsed.toFixed(1)}s
            </div>
          </div>
          
          <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden mb-4">
            <motion.div 
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ 
                background: `linear-gradient(to right, #a5b4fc, #6366f1)`,
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
                background: `linear-gradient(to right, transparent, #818cf8, transparent)`,
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
                    background: `linear-gradient(to right, #a5b4fc, #6366f1)`,
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
            <p>Retrieving document metadata and preparing your library...</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
} 