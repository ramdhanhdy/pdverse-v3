/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import FilesPage from '../page';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]), 
  })
) as jest.Mock;

// Mock the child components that are causing issues with Jest
jest.mock('@/components/premium-search-results', () => ({
  __esModule: true,
  PremiumSearchResults: () => <div>Mocked Premium Search Results</div>,
}));


describe('FilesPage', () => {
  it('renders the main heading', async () => {
    render(<FilesPage />);
    
    const heading = await screen.findByRole('heading', { name: /files/i });
    
    expect(heading).toBeInTheDocument();
  });
});
