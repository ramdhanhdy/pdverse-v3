import { create } from 'zustand';

type FileAttachment = {
  id: string;
  name: string;
};

type ChatState = {
  chatMode: 'document' | 'general';
  attachedFiles: FileAttachment[];
  isFileSidebarOpen: boolean;
  isProcessingDocuments: boolean;
  setChatMode: (mode: 'document' | 'general') => void;
  addAttachedFile: (file: FileAttachment) => void;
  removeAttachedFile: (fileId: string) => void;
  setIsFileSidebarOpen: (isOpen: boolean) => void;
  setIsProcessingDocuments: (isProcessing: boolean) => void;
  resetChatState: () => void;
};

const initialState = {
  chatMode: 'general' as 'document' | 'general',
  attachedFiles: [],
  isFileSidebarOpen: false,
  isProcessingDocuments: false,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  setChatMode: (mode) => set((state) => {
    const newState: Partial<ChatState> = { chatMode: mode };
    if (mode !== 'document') {
      newState.attachedFiles = [];
    }
    return newState;
  }),
  addAttachedFile: (file) => set((state) => ({
    attachedFiles: state.attachedFiles.find(f => f.id === file.id) 
      ? state.attachedFiles 
      : [...state.attachedFiles, file]
  })),
  removeAttachedFile: (fileId) => set((state) => ({
    attachedFiles: state.attachedFiles.filter((file) => file.id !== fileId)
  })),
  setIsFileSidebarOpen: (isOpen) => set({ isFileSidebarOpen: isOpen }),
  setIsProcessingDocuments: (isProcessing) => set({ isProcessingDocuments: isProcessing }),
  resetChatState: () => set(initialState),
}));
