/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatPage from '../page';

// Mock the useChat hook as it makes network requests
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

// Mock child components to isolate the ChatPage component
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
  it('renders the welcome message when there are no messages', () => {
    render(<ChatPage />);
    const welcomeMessage = screen.getByText(/Welcome to PDVerse Chat/i);
    expect(welcomeMessage).toBeInTheDocument();
  });
});
