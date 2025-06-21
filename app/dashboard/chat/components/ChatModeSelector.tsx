import React, { useState, useEffect } from 'react';
import { Button } from '../../../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, MessageSquare, Layers } from 'lucide-react';
import { cn } from '../../../../lib/utils';

type ChatMode = 'document' | 'general';

interface ChatModeSelectorProps {
  currentMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  compact?: boolean;
}

const modes = [
  {
    id: 'document',
    name: 'Document Chat',
    description: 'Chat with, search, and analyze documents',
    icon: Layers,
  },
  {
    id: 'general',
    name: 'General Chat',
    description: 'Chat without document context',
    icon: MessageSquare,
  },
];

export function ChatModeSelector({ currentMode, onModeChange, compact = false }: ChatModeSelectorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder on the server to prevent layout shift
    if (compact) {
      return <div className="h-9 w-9 rounded-full bg-muted/50" />;
    }
    return <div className="h-10 w-[240px] rounded-full bg-muted/50" />;
  }

  const currentModeData = modes.find((mode) => mode.id === currentMode) || modes[0];

  return (
    <div className={compact ? "flex items-center" : "flex items-center space-x-2 mb-4"}>
      <Popover>
        <PopoverTrigger asChild>
          {compact ? (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 rounded-full p-0 relative hover:bg-muted/50"
            >
              <currentModeData.icon className="h-5 w-5" />
              <span className="sr-only">{currentModeData.name}</span>
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="flex items-center justify-between w-[240px] font-normal rounded-full"
            >
              <div className="flex items-center">
                <currentModeData.icon className="mr-2 h-4 w-4" />
                <span>{currentModeData.name}</span>
              </div>
              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0 rounded-xl" align={compact ? "end" : "start"}>
          <div className="flex flex-col">
            {modes.map((mode) => (
              <Button
                key={mode.id}
                variant="ghost"
                className={cn(
                  "flex items-center justify-between px-4 py-2 text-left rounded-lg h-auto",
                  currentMode === mode.id && "bg-muted"
                )}
                onClick={() => onModeChange(mode.id as ChatMode)}
              >
                <div className="flex items-center">
                  <mode.icon className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <p className="text-sm font-medium">{mode.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-normal">{mode.description}</p>
                  </div>
                </div>
                {currentMode === mode.id && <Check className="h-4 w-4" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}