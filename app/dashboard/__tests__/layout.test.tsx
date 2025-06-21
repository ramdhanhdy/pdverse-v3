/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import DashboardLayout from '../layout';

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
  usePathname: jest.fn().mockReturnValue('/dashboard'),
}));

// Mock child components
jest.mock('@/components/theme-toggle', () => ({
  __esModule: true,
  ThemeToggle: () => <div>Mocked ThemeToggle</div>,
}));

jest.mock('@/components/animated-sidebar-button', () => ({
  __esModule: true,
  default: () => <button>Mocked Sidebar Button</button>,
}));

describe('DashboardLayout', () => {
  it('renders the main navigation links', () => {
    render(<DashboardLayout><div>Test Children</div></DashboardLayout>);
    
    const nav = screen.getByRole('navigation');
    const dashboardLink = within(nav).getByRole('link', { name: /dashboard/i });
    const filesLink = within(nav).getByRole('link', { name: /files/i });
    
    expect(dashboardLink).toBeInTheDocument();
    expect(filesLink).toBeInTheDocument();
  });
});
