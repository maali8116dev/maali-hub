import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { useAuth } from '@/hooks/useAuth';
import { useOpportunities } from '@/hooks/useOpportunities';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { useApplicationFormStore } from '@/stores/applicationForm';

// Mock data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  email_confirmed_at: '2024-01-01T00:00:00Z',
};

export const mockProject = {
  id: 1,
  title: 'Test Project',
  sector: 'Technology',
  application_fee: 0, // Free project for testing
};

export const mockDocuments = [
  {
    id: 'doc-1',
    fileName: 'test-document.pdf',
    filePath: 'user-123/test-document.pdf',
    fileSize: 2048,
    fileType: 'application/pdf',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'doc-2',
    fileName: 'test-document.doc',
    filePath: 'user-123/test-document.doc',
    fileSize: 3072,
    fileType: 'application/msword',
    createdAt: new Date().toISOString(),
  },
];

// Helper to create mock query chain
export const createMockQuery = () => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: mockOrder,
    single: mockSingle,
  };
  return mockQuery;
};

// Test wrapper with all providers
export const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Application payload type for testing
export interface ApplicationPayload {
  applicantInfo: {
    applicantType: 'Individual' | 'Organization' | 'Startup / SME' | 'NGO / Non-profit' | 'Research / Academic';
    fullLegalName: string;
    organizationName?: string;
    country: string;
    city: string;
    email: string;
    phone: string;
    registrationId?: string;
  };
  organizationInfo?: {
    yearEstablished: number;
    teamSize: number;
    mission: string;
    sectors: string[];
    teamRoles?: string;
  };
  projectOverview: {
    title: string;
    summary: string;
    problem?: string;
    solution?: string;
    beneficiaries?: string;
    geography: string;
  };
  compliance: {
    accurate: boolean;
    noConflict: boolean;
    consent: boolean;
    reporting?: boolean;
  };
  documents?: Array<{ id: string; fileName: string }>;
  projectId?: number;
}

// Helper to populate form store with payload (skips UI interactions)
export const populateFormStore = (payload: ApplicationPayload) => {
  const store = useApplicationFormStore.getState();
  
  store.setFormData({
    projectId: payload.projectId || mockProject.id,
    applicantType: payload.applicantInfo.applicantType,
    fullLegalName: payload.applicantInfo.fullLegalName,
    organizationName: payload.applicantInfo.organizationName,
    registrationIdNumber: payload.applicantInfo.registrationId,
    countryOfResidence: payload.applicantInfo.country,
    cityRegion: payload.applicantInfo.city,
    emailAddress: payload.applicantInfo.email,
    phoneNumber: payload.applicantInfo.phone,
    
    // Organizational info (if provided)
    yearEstablished: payload.organizationInfo?.yearEstablished,
    numberOfTeamMembers: payload.organizationInfo?.teamSize,
    coreMissionPurpose: payload.organizationInfo?.mission,
    primarysectors: payload.organizationInfo?.sectors,
    keyTeamMembersRoles: payload.organizationInfo?.teamRoles,
    
    // Project overview
    projectTitle: payload.projectOverview.title,
    projectSummary: payload.projectOverview.summary,
    geographicFocus: payload.projectOverview.geography,
    
    // Compliance
    informationAccurateConfirmed: payload.compliance.accurate,
    conflictOfInterestDeclared: payload.compliance.noConflict,
    dataProcessingConsented: payload.compliance.consent,
    reportingRequirementsAgreed: payload.compliance.reporting ?? payload.compliance.consent,
    
    // Documents
    uploadedDocumentIds: payload.documents?.map(doc => doc.id) || [],
    
    // Set to final step for submission testing
  });
  
  // Navigate to step 7 (Review & Submit)
  store.goToStep(7);
};

// Default application payload for testing
export const defaultApplicationPayload: ApplicationPayload = {
  applicantInfo: {
    applicantType: 'Organization',
    fullLegalName: 'John Doe',
    organizationName: 'Test Org',
    country: 'Ghana',
    city: 'Accra',
    email: 'john@example.com',
    phone: '+1234567890',
  },
  organizationInfo: {
    yearEstablished: 2020,
    teamSize: 10,
    mission: 'Test mission',
    sectors: ['Health'],
  },
  projectOverview: {
    title: 'Innovative Tech Solution',
    summary: 'A valid summary that passes validation.',
    problem: 'Defined problem',
    solution: 'Defined solution',
    beneficiaries: 'SMEs',
    geography: 'West Africa',
  },
  compliance: {
    accurate: true,
    noConflict: true,
    consent: true,
    reporting: true,
  },
  documents: [
    { id: 'doc-1', fileName: 'proposal.pdf' },
  ],
};

// Setup function for beforeEach
export const setupMocks = () => {
  vi.clearAllMocks();
  
  // Clear localStorage to reset Zustand persisted state
  localStorage.clear();
  
  // Reset the Zustand store state
  useApplicationFormStore.getState().reset();

  // Mock useAuth
  (useAuth as any).mockReturnValue({ user: mockUser });

  // Mock useOpportunities with correct paginated structure
  (useOpportunities as any).mockReturnValue({
    data: {
      opportunities: [mockProject],
      total: 1,
      page: 1,
      itemsPerPage: 9,
      totalPages: 1,
    },
    isLoading: false,
    isError: false,
  });

  // Mock useDocumentUpload
  (useDocumentUpload as any).mockReturnValue({
    uploadDocuments: vi.fn().mockResolvedValue(mockDocuments),
    deleteDocument: vi.fn().mockResolvedValue(true),
    isUploading: false,
    uploadProgress: [],
    documents: [],
    isLoading: false,
  });

  // Mock supabase.auth.getUser
  (supabase.auth.getUser as any).mockResolvedValue({
    data: { user: mockUser },
    error: null,
  });

  // Mock supabase.rpc
  (supabase as any).rpc.mockResolvedValue({ data: [], error: null });

  // Mock Supabase queries with enhanced chain
  (supabase.from as any).mockReturnValue(createMockQuery());
  
  (supabase.storage.from as any).mockReturnValue({
    upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
};









