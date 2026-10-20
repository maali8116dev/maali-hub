import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/hooks/useNotifications';
import { useActivityLogger } from '@/hooks/useActivityLogger';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));
vi.mock('@/hooks/useNotifications', () => ({
  createNotification: vi.fn(),
}));
vi.mock('@/hooks/useActivityLogger', () => ({
  useActivityLogger: vi.fn(),
}));

const mockReviewer = {
  id: 'reviewer-123',
  email: 'reviewer@example.com',
  email_confirmed_at: '2024-01-01T00:00:00Z',
};

const mockApplication = {
  id: 'app-123',
  user_id: 'applicant-456',
  project_id: 1,
  projectTitle: 'Test Project',
  applicant_type: 'Organization',
  full_legal_name: 'Test Organization',
  contact_email: 'applicant@example.com',
  status: 'pending',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Helper function to test approve logic (business logic only, no UI)
const testApproveApplication = async (
  applicationId: string,
  application: typeof mockApplication,
  reviewerId: string,
  reviewNotes: string,
  isReviewer: boolean
) => {
  // Role check
  if (!isReviewer) {
    return { success: false, error: 'Access Denied' };
  }

  if (!applicationId || !application) {
    return { success: false, error: 'Missing application data' };
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  const now = new Date().toISOString();
  
  // Update application
  const { error: updateError } = await supabase
    .from('applications')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: now,
      review_notes: reviewNotes.trim() || null,
      updated_at: now,
    })
    .eq('id', applicationId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Log activity
  const { logActivity } = useActivityLogger();
  await logActivity({
    actionType: 'approve',
    entityType: 'application',
    entityId: applicationId,
    description: `Approved application for "${application.projectTitle}"`,
    metadata: {
      application_id: applicationId,
      project_id: application.project_id,
      project_title: application.projectTitle,
      reviewer_id: user.id,
      review_notes: reviewNotes.trim() || null,
    },
  });

  // Create notification
  await createNotification(
    application.user_id,
    'Application Approved!',
    `Congratulations! Your application for "${application.projectTitle}" has been approved.`,
    'application',
    `/dashboard/applications/${applicationId}`,
    {
      application_id: applicationId,
      project_id: application.project_id,
      status: 'approved',
    }
  );

  return { success: true };
};

// Helper function to test reject logic (business logic only, no UI)
const testRejectApplication = async (
  applicationId: string,
  application: typeof mockApplication,
  reviewerId: string,
  reviewNotes: string,
  isReviewer: boolean
) => {
  // Role check
  if (!isReviewer) {
    return { success: false, error: 'Access Denied' };
  }

  // Notes required for rejection
  if (!reviewNotes.trim()) {
    return { success: false, error: 'Review Notes Required' };
  }

  if (!applicationId || !application) {
    return { success: false, error: 'Missing application data' };
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  const now = new Date().toISOString();
  
  // Update application
  const { error: updateError } = await supabase
    .from('applications')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: now,
      review_notes: reviewNotes.trim() || null,
      updated_at: now,
    })
    .eq('id', applicationId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Log activity
  const { logActivity } = useActivityLogger();
  await logActivity({
    actionType: 'reject',
    entityType: 'application',
    entityId: applicationId,
    description: `Rejected application for "${application.projectTitle}"`,
    metadata: {
      application_id: applicationId,
      project_id: application.project_id,
      project_title: application.projectTitle,
      reviewer_id: user.id,
      review_notes: reviewNotes.trim() || null,
    },
  });

  // Create notification
  await createNotification(
    application.user_id,
    'Application Rejected',
    `Your application for "${application.projectTitle}" has been rejected.`,
    'application',
    `/dashboard/applications/${applicationId}`,
    {
      application_id: applicationId,
      project_id: application.project_id,
      status: 'rejected',
    }
  );

  return { success: true };
};

describe('ReviewApplication - Approve/Reject Business Logic', () => {
  let mockLogActivity: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockEq: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity = vi.fn().mockResolvedValue(undefined);
    (useActivityLogger as any).mockReturnValue({
      logActivity: mockLogActivity,
    });

    mockUpdate = vi.fn().mockReturnThis();
    mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'applications') {
        return {
          update: mockUpdate,
          eq: mockEq,
        };
      }
      return {
        update: mockUpdate,
        eq: mockEq,
      };
    });

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockReviewer },
      error: null,
    });
  });

  describe('Approve Application', () => {
    it('should successfully approve an application', async () => {
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockResolvedValue({
        data: { ...mockApplication, status: 'approved' },
        error: null,
      });

      const result = await testApproveApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        'Great application!',
        true // isReviewer
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          reviewed_by: mockReviewer.id,
          review_notes: 'Great application!',
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'app-123');

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'approve',
          entityType: 'application',
          entityId: 'app-123',
          description: expect.stringContaining('Test Project'),
          metadata: expect.objectContaining({
            application_id: 'app-123',
            project_id: 1,
            reviewer_id: mockReviewer.id,
            review_notes: 'Great application!',
          }),
        })
      );

      expect(createNotification).toHaveBeenCalledWith(
        'applicant-456',
        'Application Approved!',
        expect.stringContaining('approved'),
        'application',
        '/dashboard/applications/app-123',
        expect.objectContaining({
          application_id: 'app-123',
          project_id: 1,
          status: 'approved',
        })
      );
    });

    it('should only allow reviewers to approve', async () => {
      const result = await testApproveApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        'Notes',
        false // isReviewer = false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access Denied');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should handle errors when approving', async () => {
      const mockError = { message: 'Database error', code: 'PGRST116' };
      
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      });

      const result = await testApproveApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        'Notes',
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should save review notes when approving', async () => {
      const reviewNotes = 'This is a great application with strong potential.';
      
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockResolvedValue({
        data: { ...mockApplication, status: 'approved' },
        error: null,
      });

      await testApproveApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        reviewNotes,
        true
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          review_notes: reviewNotes,
        })
      );
    });

    it('should handle empty review notes (null)', async () => {
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockResolvedValue({
        data: { ...mockApplication, status: 'approved' },
        error: null,
      });

      await testApproveApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        '', // Empty notes
        true
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          review_notes: null,
        })
      );
    });

    it('should set reviewed_by to current user ID', async () => {
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockResolvedValue({
        data: { ...mockApplication, status: 'approved' },
        error: null,
      });

      await testApproveApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        'Notes',
        true
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewed_by: mockReviewer.id,
        })
      );
    });

    it('should handle missing application data', async () => {
      const result = await testApproveApplication(
        '',
        mockApplication,
        mockReviewer.id,
        'Notes',
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing application data');
    });

    it('should handle unauthenticated user', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await testApproveApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        'Notes',
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });
  });

  describe('Reject Application', () => {
    it('should successfully reject an application with notes', async () => {
      const reviewNotes = 'Application does not meet the required criteria.';
      
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockResolvedValue({
        data: { ...mockApplication, status: 'rejected' },
        error: null,
      });

      const result = await testRejectApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        reviewNotes,
        true // isReviewer
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          reviewed_by: mockReviewer.id,
          review_notes: reviewNotes,
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'app-123');

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'reject',
          entityType: 'application',
          entityId: 'app-123',
          description: expect.stringContaining('Test Project'),
          metadata: expect.objectContaining({
            application_id: 'app-123',
            project_id: 1,
            reviewer_id: mockReviewer.id,
            review_notes: reviewNotes,
          }),
        })
      );

      expect(createNotification).toHaveBeenCalledWith(
        'applicant-456',
        'Application Rejected',
        expect.stringContaining('rejected'),
        'application',
        '/dashboard/applications/app-123',
        expect.objectContaining({
          application_id: 'app-123',
          project_id: 1,
          status: 'rejected',
        })
      );
    });

    it('should require review notes before rejecting', async () => {
      const result = await testRejectApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        '', // Empty notes
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Review Notes Required');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should only allow reviewers to reject', async () => {
      const result = await testRejectApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        'Rejection notes',
        false // isReviewer = false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access Denied');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should handle errors when rejecting', async () => {
      const mockError = { message: 'Database error', code: 'PGRST116' };
      
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      });

      const result = await testRejectApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        'Rejection notes',
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should trim review notes', async () => {
      const reviewNotes = '  Notes with whitespace  ';
      
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockResolvedValue({
        data: { ...mockApplication, status: 'rejected' },
        error: null,
      });

      await testRejectApplication(
        'app-123',
        mockApplication,
        mockReviewer.id,
        reviewNotes,
        true
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          review_notes: 'Notes with whitespace',
        })
      );
    });
  });
});









