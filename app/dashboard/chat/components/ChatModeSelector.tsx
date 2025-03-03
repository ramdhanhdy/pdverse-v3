import React from 'react';
import { Button } from '../../../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, FileText, MessageSquare, Search, Zap } from 'lucide-react';
import { cn } from '../../../../lib/utils';

type ChatMode = 'document' | 'general' | 'search' | 'advanced';

interface ChatModeSelectorProps {
  currentMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  compact?: boolean;
}

const modes = [
  {
    id: 'document',
    name: 'Enhanced Document Chat',
    description: 'Smart chat with multi-layer document understanding',
    icon: FileText,
  },
  {
    id: 'general',
    name: 'General Chat',
    description: 'Chat without document context',
    icon: MessageSquare,
  },
  {
    id: 'search',
    name: 'Search Mode',
    description: 'Search across all documents',
    icon: Search,
  },
  {
    id: 'advanced',
    name: 'Advanced Analysis',
    description: 'Deep document analysis',
    icon: Zap,
  },
];

export function ChatModeSelector({ currentMode, onModeChange, compact = false }: ChatModeSelectorProps) {
  const currentModeData = modes.find((mode) => mode.id === currentMode) || modes[0];

  return (
    <div className={compact ? "flex items-center" : "flex items-center space-x-2 mb-4"}>
      <Popover>
        <PopoverTrigger asChild>
          {compact ? (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 rounded-full p-0"
            >
              <currentModeData.icon className="h-5 w-5" />
              <span className="sr-only">{currentModeData.name}</span>
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="flex items-center justify-between w-[240px] font-normal"
            >
              <div className="flex items-center">
                <currentModeData.icon className="mr-2 h-4 w-4" />
                <span>{currentModeData.name}</span>
              </div>
              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align={compact ? "end" : "start"}>
          <div className="flex flex-col">
            {modes.map((mode) => (
              <Button
                key={mode.id}
                variant="ghost"
                className={cn(
                  "flex items-center justify-between px-4 py-2 text-left",
                  currentMode === mode.id && "bg-muted"
                )}
                onClick={() => onModeChange(mode.id as ChatMode)}
              >
                <div className="flex items-center">
                  <mode.icon className="mr-2 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">{mode.name}</p>
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
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