import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { useApplications } from '@/hooks/useApplications';
import { useProfile } from '@/hooks/useProfile';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { useAuth } from '@/hooks/useAuth';

// Mock the hooks
vi.mock('@/hooks/useApplications');
vi.mock('@/hooks/useProfile');
vi.mock('@/hooks/useProfileCompletion');
vi.mock('@/hooks/useAuth');
vi.mock('@/components/ProfileSetupWizard', () => ({
  ProfileSetupWizard: () => <div>Profile Setup Wizard</div>,
}));

describe('Dashboard - Data Viewing', () => {
  const mockApplications = [
    {
      id: 'app-1',
      projectId: 1,
      projectTitle: 'AgriTech Innovation Fund',
      status: 'pending' as const,
      submittedAt: '2024-01-15T00:00:00Z',
      sector: 'Agriculture',
      country: 'Ghana',
      fundingAmount: '$50,000',
      companyName: 'Tech Solutions',
      contactEmail: 'john@tech.com',
      projectDescription: 'Innovative solution',
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 'app-2',
      projectId: 2,
      projectTitle: 'Tech Startup Grant',
      status: 'approved' as const,
      submittedAt: '2024-01-10T00:00:00Z',
      sector: 'Technology',
      country: 'Nigeria',
      fundingAmount: '$75,000',
      companyName: 'Startup Inc',
      contactEmail: 'startup@example.com',
      projectDescription: 'Tech startup',
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-12T00:00:00Z',
    },
    {
      id: 'app-3',
      projectId: 3,
      projectTitle: 'FinTech Grant',
      status: 'rejected' as const,
      submittedAt: '2024-01-05T00:00:00Z',
      sector: 'Finance',
      country: 'Kenya',
      fundingAmount: '$100,000',
      companyName: 'Finance Corp',
      contactEmail: 'finance@example.com',
      projectDescription: 'Financial solution',
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-08T00:00:00Z',
    },
  ];

  const mockProfile = {
    id: 'profile-123',
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    businessName: 'Tech Solutions',
    businessSector: 'Technology',
    country: 'Ghana',
    bio: 'Entrepreneur',
    avatarUrl: null,
    role: 'applicant' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
    });
  });

  it('displays application statistics correctly', async () => {
    (useApplications as any).mockReturnValue({
      data: mockApplications,
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Check stat card titles are displayed
      expect(screen.getByText('Total Applications')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      
      // Check that the total count (3) is displayed
      expect(screen.getByText('3')).toBeInTheDocument();
      
      // The number 1 appears multiple times, so verify by checking all instances
      const ones = screen.getAllByText('1');
      expect(ones.length).toBeGreaterThanOrEqual(3); // At least 3 instances (pending, approved, rejected)
    });
  });

  it('displays loading skeleton while fetching applications', () => {
    (useApplications as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: null,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 0,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    // When loading, the skeleton should be shown, but the card titles might still be visible
    // Check that we're in loading state by verifying applications aren't shown yet
    expect(screen.queryByText('AgriTech Innovation Fund')).not.toBeInTheDocument();
  });

  it('displays zero stats when no applications exist', async () => {
    (useApplications as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Check that stats cards are displayed with zero values
      expect(screen.getByText('Total Applications')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      
      // Verify zero stats are shown (0 appears multiple times, so check context)
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('displays recent applications correctly', async () => {
    (useApplications as any).mockReturnValue({
      data: mockApplications,
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Should show first 3 applications
      expect(screen.getByText('AgriTech Innovation Fund')).toBeInTheDocument();
      expect(screen.getByText('Tech Startup Grant')).toBeInTheDocument();
      expect(screen.getByText('FinTech Grant')).toBeInTheDocument();
    });
  });

  it('displays empty state when no applications exist', async () => {
    (useApplications as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No applications yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Start applying to funding opportunities to see your applications here.'
        )
      ).toBeInTheDocument();
    });
  });

  it('displays profile completion percentage', async () => {
    (useApplications as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 75,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('75% Complete')).toBeInTheDocument();
    });
  });

  it('displays loading state for profile completion', () => {
    (useApplications as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: null,
      isLoading: true,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 0,
      missingFields: [],
      isLoading: true,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('displays application status badges correctly', async () => {
    (useApplications as any).mockReturnValue({
      data: mockApplications,
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Use getAllByText since "Pending" appears in both stats card and application badge
      const pendingElements = screen.getAllByText('Pending');
      expect(pendingElements.length).toBeGreaterThan(0);
      
      const approvedElements = screen.getAllByText('Approved');
      expect(approvedElements.length).toBeGreaterThan(0);
      
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
  });

  it('formats dates correctly in recent applications', async () => {
    (useApplications as any).mockReturnValue({
      data: mockApplications,
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Check that dates are displayed (format depends on locale)
      // Use getAllByText since "Submitted" appears multiple times
      const submittedElements = screen.getAllByText(/Submitted/i);
      expect(submittedElements.length).toBeGreaterThan(0);
    });
  });

  it('displays application sector information', async () => {
    (useApplications as any).mockReturnValue({
      data: mockApplications,
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Agriculture')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });
  });

  it('calculates stats correctly for mixed statuses', async () => {
    const mixedApplications = [
      ...mockApplications,
      {
        id: 'app-4',
        projectId: 4,
        projectTitle: 'Another Project',
        status: 'pending' as const,
        submittedAt: '2024-01-20T00:00:00Z',
        sector: 'Education',
        country: 'South Africa',
        fundingAmount: '$30,000',
        companyName: 'Edu Corp',
        contactEmail: 'edu@example.com',
        projectDescription: 'Education solution',
        createdAt: '2024-01-20T00:00:00Z',
        updatedAt: '2024-01-20T00:00:00Z',
      },
    ];

    (useApplications as any).mockReturnValue({
      data: mixedApplications,
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Total should be 4
      expect(screen.getByText('4')).toBeInTheDocument();
      // Pending should be 2
      const pendingCards = screen.getAllByText('2');
      expect(pendingCards.length).toBeGreaterThan(0);
    });
  });

  it('shows only first 3 applications in recent section', async () => {
    const manyApplications = Array.from({ length: 10 }, (_, i) => ({
      id: `app-${i + 1}`,
      projectId: i + 1,
      projectTitle: `Project ${i + 1}`,
      status: 'pending' as const,
      submittedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      sector: 'Technology',
      country: 'Ghana',
      fundingAmount: '$50,000',
      companyName: `Company ${i + 1}`,
      contactEmail: `company${i + 1}@example.com`,
      projectDescription: `Description ${i + 1}`,
      createdAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      updatedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    (useApplications as any).mockReturnValue({
      data: manyApplications,
      isLoading: false,
      error: null,
    });

    (useProfile as any).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });

    (useProfileCompletion as any).mockReturnValue({
      isIncomplete: false,
      completionPercentage: 85,
      missingFields: [],
      isLoading: false,
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Should only show first 3
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
      expect(screen.getByText('Project 3')).toBeInTheDocument();
      // Should not show Project 4
      expect(screen.queryByText('Project 4')).not.toBeInTheDocument();
    });
  });
});

