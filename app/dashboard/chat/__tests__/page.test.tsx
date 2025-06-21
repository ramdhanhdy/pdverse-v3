/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatPage from '../page';

// Mock the useChat hook
jest.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    input: '',
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn(),
    isLoading: false,
    setInput: jest.fn(),
  }),
}));

// Mock the Zustand stores
jest.mock('@/lib/store/themeStore', () => ({
  useThemeStore: () => ({
    theme: 'light',
  }),
}));

jest.mock('@/lib/store/chatStore', () => ({
  useChatStore: () => ({
    chatMode: 'general',
    setChatMode: jest.fn(),
    attachedFiles: [],
    addAttachedFile: jest.fn(),
    removeAttachedFile: jest.fn(),
    isFileSidebarOpen: false,
    setIsFileSidebarOpen: jest.fn(),
    isProcessingDocuments: false,
    setIsProcessingDocuments: jest.fn(),
  }),
}));


// Mock child components
jest.mock('../components/FileSidebar', () => ({
    __esModule: true,
    FileSidebar: () => <div>Mocked FileSidebar</div>
}));
jest.mock('../components/ChatModeSelector', () => ({
    __esModule: true,
    ChatModeSelector: () => <div>Mocked ChatModeSelector</div>
}));
jest.mock('../components/DocumentChatMessage', () => ({
    __esModule: true,
    DocumentChatMessage: () => <div>Mocked DocumentChatMessage</div>
}));

describe('ChatPage', () => {
  beforeEach(() => {
    // We can reset mocks if needed between tests, but for now this is fine.
  });

  it('renders the welcome message when there are no messages', () => {
    render(<ChatPage />);
    const welcomeMessage = screen.getByText(/Welcome to PDVerse Chat/i);
    expect(welcomeMessage).toBeInTheDocument();
  });
});
