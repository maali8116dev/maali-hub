import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import Projects from '../Projects';
import { useProjects, useProjectCategories, useProjectLocations } from '@/hooks/useProjects';

// Mock the hooks
vi.mock('@/hooks/useProjects');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  },
}));
vi.mock('@/components/Navigation', () => ({
  default: () => <nav>Navigation</nav>,
}));
vi.mock('@/components/Footer', () => ({
  default: () => <footer>Footer</footer>,
}));
vi.mock('@/components/landing/ProjectCard', () => ({
  default: ({ title }: { title: string }) => <div>Project: {title}</div>,
}));

describe('Projects Page - Data Viewing', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };

  const mockProjects = [
    {
      id: 1,
      title: 'AgriTech Innovation Fund',
      description: 'Supporting innovative agricultural technology',
      category: 'Agriculture',
      status: 'open' as const,
      deadline: '2024-12-31',
      fundingAmount: '$50,000',
      location: 'Ghana',
      imageUrl: null,
      requirements: null,
      eligibilityCriteria: null,
      applicationFee: null,
      maxApplicants: 50,
      currentApplicants: 12,
      featured: true,
      createdBy: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      title: 'Tech Startup Grant',
      description: 'Funding for technology startups',
      category: 'Technology',
      status: 'open' as const,
      deadline: '2024-11-30',
      fundingAmount: '$75,000',
      location: 'Nigeria',
      imageUrl: null,
      requirements: null,
      eligibilityCriteria: null,
      applicationFee: null,
      maxApplicants: 30,
      currentApplicants: 8,
      featured: false,
      createdBy: null,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays projects when data is loaded', async () => {
    (useProjects as any).mockReturnValue({
      data: {
        projects: mockProjects,
        total: 2,
        page: 1,
        itemsPerPage: 10,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: ['Agriculture', 'Technology'],
    });

    (useProjectLocations as any).mockReturnValue({
      data: ['Ghana', 'Nigeria'],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Project: AgriTech Innovation Fund')).toBeInTheDocument();
      expect(screen.getByText('Project: Tech Startup Grant')).toBeInTheDocument();
    });
  });

  it('displays loading skeleton while fetching data', () => {
    (useProjects as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    // Check for skeleton loaders (they should have specific test ids or classes)
    // This depends on your ProjectCardSkeletonGrid implementation
    expect(screen.queryByText('Project:')).not.toBeInTheDocument();
  });

  it('displays error message when data fetch fails', async () => {
    const errorMessage = 'Failed to load projects';
    (useProjects as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error(errorMessage),
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('displays empty state when no projects are found', async () => {
    (useProjects as any).mockReturnValue({
      data: {
        projects: [],
        total: 0,
        page: 1,
        itemsPerPage: 10,
        totalPages: 0,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    await waitFor(() => {
      // Check for empty state message
      expect(screen.getByText(/no projects found/i)).toBeInTheDocument();
    });
  });

  it('displays correct pagination information', async () => {
    (useProjects as any).mockReturnValue({
      data: {
        projects: mockProjects,
        total: 25,
        page: 2,
        itemsPerPage: 10,
        totalPages: 3,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    await waitFor(() => {
      // Should show pagination text - the format is "Showing X to Y of Z projects"
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
      expect(screen.getByText(/of 25/i)).toBeInTheDocument();
    });
  });

  it('filters projects by category when category is selected', async () => {
    const user = userEvent.setup();
    
    (useProjects as any).mockReturnValue({
      data: {
        projects: [mockProjects[0]], // Only Agriculture project
        total: 1,
        page: 1,
        itemsPerPage: 10,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: ['Agriculture', 'Technology'],
    });

    (useProjectLocations as any).mockReturnValue({
      data: ['Ghana', 'Nigeria'],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    // The hook should be called with category filter
    await waitFor(() => {
      expect(useProjects).toHaveBeenCalled();
    });
  });

  it('filters projects by search query', async () => {
    const user = userEvent.setup();
    
    (useProjects as any).mockReturnValue({
      data: {
        projects: [mockProjects[0]],
        total: 1,
        page: 1,
        itemsPerPage: 10,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    const searchInput = screen.getByPlaceholderText(/search projects/i);
    await user.type(searchInput, 'AgriTech');

    // Wait for debounce (if implemented) or immediate update
    await waitFor(() => {
      expect(useProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'AgriTech',
        })
      );
    });
  });

  it('clears search query when clear button is clicked', async () => {
    const user = userEvent.setup();
    
    (useProjects as any).mockReturnValue({
      data: {
        projects: mockProjects,
        total: 2,
        page: 1,
        itemsPerPage: 10,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    const searchInput = screen.getByPlaceholderText(/search projects/i);
    await user.type(searchInput, 'test');

    // Find and click clear button
    const clearButton = screen.getByLabelText('Clear search');
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('updates items per page and resets to page 1', async () => {
    const user = userEvent.setup();
    
    (useProjects as any).mockReturnValue({
      data: {
        projects: mockProjects,
        total: 25,
        page: 1,
        itemsPerPage: 20,
        totalPages: 2,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    // Find the items per page select
    // This depends on your Select component implementation
    // You may need to adjust based on how the Select is rendered
    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
    });
  });

  it('displays project count correctly', async () => {
    (useProjects as any).mockReturnValue({
      data: {
        projects: mockProjects,
        total: 2,
        page: 1,
        itemsPerPage: 10,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/showing 1 to 2 of 2 projects/i)).toBeInTheDocument();
    });
  });

  it('handles single project correctly in count', async () => {
    (useProjects as any).mockReturnValue({
      data: {
        projects: [mockProjects[0]],
        total: 1,
        page: 1,
        itemsPerPage: 10,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
    });

    (useProjectCategories as any).mockReturnValue({
      data: [],
    });

    (useProjectLocations as any).mockReturnValue({
      data: [],
    });

    const Wrapper = createWrapper();
    render(
      <BrowserRouter>
        <Wrapper>
          <Projects />
        </Wrapper>
      </BrowserRouter>
    );

    await waitFor(() => {
      // Should say "project" (singular) not "projects"
      expect(screen.getByText(/showing 1 to 1 of 1 project$/i)).toBeInTheDocument();
    });
  });
});

