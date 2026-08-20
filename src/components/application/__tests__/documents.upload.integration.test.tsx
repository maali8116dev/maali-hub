import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Use real Supabase client for integration tests
// These tests require actual database and storage access
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";

// Create a real Supabase client for integration tests
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Test user credentials (set these in your .env file)
const TEST_USER_EMAIL = import.meta.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = import.meta.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

const BUCKET_NAME = "application-docs";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const filesDir = join(process.cwd(), 'src', 'test', 'files');

const loadTestFile = (filename: string, mimeType: string, aliasName?: string) => {
  const buffer = readFileSync(join(filesDir, filename));
  return {
    name: aliasName ?? filename,
    type: mimeType,
    buffer,
    size: buffer.length,
  };
};

/**
 * Integration tests for document uploads
 * These tests interact with the real Supabase database and storage
 * 
 * IMPORTANT: These tests require:
 * 1. A valid Supabase project with the application-docs bucket configured
 * 2. A test user account (set VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD)
 * 3. Proper RLS policies configured
 * 
 * To run these tests:
 * npm test -- documents.upload.integration.test.tsx
 * 
 * To see the test data in your database:
 * 1. Go to Supabase Dashboard > Table Editor > application_documents
 * 2. Go to Supabase Dashboard > Storage > application-docs bucket
 */
describe('Document Upload - Real Integration Tests', () => {
  let testUser: { id: string; email: string } | null = null;
  let projectId: number | null = null;
  const uploadedDocumentIds: string[] = [];
  const uploadedFilePaths: string[] = [];
  const createdApplicationIds: string[] = [];

  beforeAll(async () => {
    // Sign in as test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (authError || !authData.user) {
      console.warn('âš ï¸  Could not authenticate test user. Skipping integration tests.');
      console.warn('Set VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD environment variables.');
      console.warn('Or create a test user in Supabase Dashboard with:');
      console.warn(`  Email: ${TEST_USER_EMAIL}`);
      console.warn(`  Password: ${TEST_USER_PASSWORD}`);
      return;
    }

    testUser = {
      id: authData.user.id,
      email: authData.user.email!,
    };

    console.log(`âœ… Authenticated as test user: ${testUser.email}`);
    console.log(`   User ID: ${testUser.id}`);

    // Find a project to link applications to
    const { data: opportunities, error: opportunityError } = await supabase
      .from('opportunities')
      .select('id')
      .limit(1);

    if (opportunityError) {
      console.warn('âš ï¸  Could not fetch a project for application linking:', opportunityError);
    } else if (!opportunities || opportunities.length === 0) {
      console.warn('âš ï¸  No opportunities found. Applications will not be created.');
    } else {
      projectId = opportunities[0].id;
      console.log(`âœ… Using project ID for applications: ${projectId}`);
    }
  });

  afterAll(async () => {
    // Sign out
    await supabase.auth.signOut();
    console.log('âœ… Signed out from test session');
  });

  afterEach(async () => {
    const preserveUploads = import.meta.env.VITE_PRESERVE_UPLOAD_TEST_DATA === 'true';
    if (preserveUploads) {
      console.log('â„¹ï¸  Preserving upload test data (VITE_PRESERVE_UPLOAD_TEST_DATA=true)');
      return;
    }

    // Cleanup: Delete uploaded documents from database and storage
    if (uploadedDocumentIds.length > 0 || uploadedFilePaths.length > 0) {
      try {
        if (createdApplicationIds.length > 0) {
          const { error: appError } = await supabase
            .from('applications')
            .delete()
            .in('id', createdApplicationIds);

          if (appError) {
            console.warn('Failed to cleanup applications from DB:', appError);
          } else {
            console.log(`âœ… Cleaned up ${createdApplicationIds.length} application(s) from database`);
          }
        }

        // Delete from database
        if (uploadedDocumentIds.length > 0) {
          const { error: dbError } = await supabase
            .from('application_documents')
            .delete()
            .in('id', uploadedDocumentIds);

          if (dbError) {
            console.warn('Failed to cleanup documents from DB:', dbError);
          } else {
            console.log(`âœ… Cleaned up ${uploadedDocumentIds.length} document(s) from database`);
          }
        }

        // Delete from storage
        if (uploadedFilePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(uploadedFilePaths);

          if (storageError) {
            console.warn('Failed to cleanup files from storage:', storageError);
          } else {
            console.log(`âœ… Cleaned up ${uploadedFilePaths.length} file(s) from storage`);
          }
        }
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
      
      uploadedDocumentIds.length = 0;
      uploadedFilePaths.length = 0;
      createdApplicationIds.length = 0;
    }
  });

  // Helper function to upload a document directly
  const uploadDocumentDirect = async (
    file: { name: string; type: string; buffer: Buffer; size: number },
    applicationId?: string,
    projectId?: number
  ) => {
    if (!testUser) {
      throw new Error('No authenticated test user');
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File "${file.name}" is too large. Maximum size is 10MB.`);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`File "${file.name}" has an invalid type. Allowed types: PDF, DOC, DOCX, TXT.`);
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${testUser.id}/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Save metadata to database
    const { data: docData, error: dbError } = await supabase
      .from("application_documents")
      .insert({
        user_id: testUser.id,
        application_id: applicationId || null,
        opportunity_id: projectId || null,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete the uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      throw dbError;
    }

    return {
      id: docData.id,
      fileName: docData.file_name,
      filePath: docData.file_path,
      fileSize: docData.file_size || 0,
      fileType: docData.file_type || "",
      createdAt: docData.created_at,
      applicationId: docData.application_id || undefined,
    };
  };

  const createApplication = async () => {
    if (!testUser) {
      throw new Error('No authenticated test user');
    }
    if (!projectId) {
      console.warn('âš ï¸  No project available. Skipping application creation.');
      return null;
    }

    const { data: application, error } = await (supabase
      .from('applications') as any)
      .insert({
        user_id: testUser.id,
        opportunity_id: projectId,
        applicant_type: 'Organization',
        full_legal_name: 'Integration Test User',
        organization_name: 'Integration Test Org',
        country_of_residence: 'Ghana',
        city_region: 'Accra',
        contact_email: testUser.email,
        contact_phone: '+1234567890',
        project_title: 'Integration Test Project',
        project_summary: 'Integration test application summary.',
        problem_statement: 'Integration test problem statement.',
        proposed_solution: 'Integration test solution.',
        target_beneficiaries: 'Integration test beneficiaries.',
        geographic_focus: 'Integration test geography.',
        information_accurate_confirmed: true,
        conflict_of_interest_declared: false,
        reporting_requirements_agreed: true,
        data_processing_consented: true,
        is_draft: false,
        status: 'submitted',
      })
      .select()
      .single();

    if (error) {
      console.warn('âš ï¸  Failed to create application:', error);
      return null;
    }

    createdApplicationIds.push(application.id);
    return application.id as string;
  };

  it('should upload a PDF document to Supabase Storage and save metadata to DB', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const testFile = loadTestFile('test-document.pdf', 'application/pdf', 'test-application.pdf');
    const applicationId = await createApplication();

    // Upload the file directly
    const result = await uploadDocumentDirect(testFile, applicationId ?? undefined, projectId ?? 1);

    // Track for cleanup
    uploadedDocumentIds.push(result.id);
    uploadedFilePaths.push(result.filePath);

    // Verify upload was successful
    expect(result).not.toBeNull();
    expect(result.fileName).toBe('test-application.pdf');
    expect(result.fileType).toBe('application/pdf');
    expect(result.fileSize).toBe(testFile.size);

    // Verify it was saved to database
    const { data: dbDoc, error } = await supabase
      .from('application_documents')
      .select('*')
      .eq('id', result.id)
      .single();

    expect(error).toBeNull();
    expect(dbDoc).not.toBeNull();
    expect(dbDoc?.file_name).toBe('test-application.pdf');
    expect(dbDoc?.user_id).toBe(testUser.id);
    expect(dbDoc?.file_type).toBe('application/pdf');
    expect(dbDoc?.file_size).toBe(testFile.size);

    console.log(`âœ… Uploaded document ID: ${result.id}`);
    console.log(`   Check Supabase Dashboard > Table Editor > application_documents`);
    console.log(`   Check Supabase Dashboard > Storage > ${BUCKET_NAME} bucket`);
  });

  it('should upload multiple documents and save all to DB', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const files = [
      loadTestFile('test-document.pdf', 'application/pdf'),
      loadTestFile('test-document.doc', 'application/msword'),
      loadTestFile('test-document.txt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      loadTestFile('text-document.txt', 'text/plain'),
    ];
    const results = [];
    const applicationId = await createApplication();

    // Upload all files
    for (const file of files) {
      const result = await uploadDocumentDirect(file, applicationId ?? undefined, projectId ?? 1);
      results.push(result);
      uploadedDocumentIds.push(result.id);
      uploadedFilePaths.push(result.filePath);
    }

    // Verify all uploads succeeded
    expect(results.length).toBe(files.length);

    // Verify all are in database
    const { data: dbDocs, error } = await supabase
      .from('application_documents')
      .select('*')
      .in('id', results.map(r => r.id));

    expect(error).toBeNull();
    expect(dbDocs?.length).toBe(files.length);
    
    // Verify all belong to test user
    dbDocs?.forEach(doc => {
      expect(doc.user_id).toBe(testUser!.id);
    });

    console.log(`âœ… Uploaded ${results.length} documents`);
    console.log(`   Document IDs: ${results.map(r => r.id).join(', ')}`);
  }, 20000);

  it('should handle different file types (PDF, DOC, TXT)', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const pdfFile = loadTestFile('test-document.pdf', 'application/pdf', 'test.pdf');
    const docFile = loadTestFile('test-document.doc', 'application/msword', 'test.doc');
    const txtFile = loadTestFile('text-document.txt', 'text/plain', 'test.txt');
    const applicationId = await createApplication();

    const pdfResult = await uploadDocumentDirect(pdfFile, applicationId ?? undefined, projectId ?? 1);
    const docResult = await uploadDocumentDirect(docFile, applicationId ?? undefined, projectId ?? 1);
    const txtResult = await uploadDocumentDirect(txtFile, applicationId ?? undefined, projectId ?? 1);

    // Track for cleanup
    [pdfResult, docResult, txtResult].forEach(result => {
      uploadedDocumentIds.push(result.id);
      uploadedFilePaths.push(result.filePath);
    });

    expect(pdfResult.fileType).toBe('application/pdf');
    expect(docResult.fileType).toBe('application/msword');
    expect(txtResult.fileType).toBe('text/plain');

    // Verify all are in database with correct types
    const { data: dbDocs } = await supabase
      .from('application_documents')
      .select('*')
      .in('id', [pdfResult.id, docResult.id, txtResult.id]);

    expect(dbDocs?.length).toBe(3);
    expect(dbDocs?.find(d => d.file_type === 'application/pdf')).toBeDefined();
    expect(dbDocs?.find(d => d.file_type === 'application/msword')).toBeDefined();
    expect(dbDocs?.find(d => d.file_type === 'text/plain')).toBeDefined();

    console.log(`âœ… Uploaded 3 different file types`);
  }, 20000);

  it('should verify files are accessible in storage', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const testFile = loadTestFile('test-document.pdf', 'application/pdf', 'storage-test.pdf');
    const applicationId = await createApplication();
    const result = await uploadDocumentDirect(testFile, applicationId ?? undefined, projectId ?? 1);

    uploadedDocumentIds.push(result.id);
    uploadedFilePaths.push(result.filePath);

    // Verify file exists in storage
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(testUser.id, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    expect(error).toBeNull();
    expect(files).toBeDefined();
    
    // Find our uploaded file
    const uploadedFile = files?.find(f => f.name.includes('storage-test.pdf'));
    expect(uploadedFile).toBeDefined();
    expect(uploadedFile?.metadata?.size).toBe(testFile.size);

    console.log(`âœ… Verified file exists in storage: ${result.filePath}`);
  });
});








