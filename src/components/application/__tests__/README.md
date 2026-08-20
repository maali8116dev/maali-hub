# Application Form Integration Tests

This directory contains comprehensive integration tests for the `MultiStepApplicationForm` component.

## Test Coverage

The integration test (`MultiStepApplicationForm.integration.test.tsx`) covers:

### All 7 Form Steps:
1. **Step 1: Applicant Information** - Tests all applicant fields including type, name, organization, contact details
2. **Step 2: Organizational Background** - Tests organizational details, sectors, team information (skipped for Individual applicants)
3. **Step 3: Project Overview** - Tests project title, summary, problem statement, solution, beneficiaries, geographic focus
4. **Step 4: Compliance & Declarations** - Tests all required compliance checkboxes
5. **Step 5: Document Upload** - Tests file upload functionality with various file types
6. **Step 6: Payment** - Tests payment flow (skipped for free projects)
7. **Step 7: Review & Submit** - Tests review of all entered data and final submission

### File Upload Testing:
- ✅ Upload single PDF document
- ✅ Upload multiple document types (PDF, DOC, DOCX, TXT)
- ✅ Reject files that exceed size limits (10MB)
- ✅ Reject unsupported file types
- ✅ Upload multiple files simultaneously

### Complete Application Flow:
- ✅ Full end-to-end test from step 1 through submission
- ✅ Navigation between steps
- ✅ Form validation at each step
- ✅ Data persistence across steps

## Test Utilities

The test uses helper functions from `@/test/utils/file-helpers.ts`:
- `createDummyPDF()` - Creates dummy PDF files
- `createDummyDOC()` - Creates dummy DOC files
- `createDummyDOCX()` - Creates dummy DOCX files
- `createDummyTXT()` - Creates dummy TXT files
- `createMultipleDummyFiles()` - Creates multiple files of different types
- `createOversizedFile()` - Creates files that exceed size limits (for validation testing)
- `createUnsupportedFile()` - Creates files with unsupported MIME types (for validation testing)

## Running the Tests

```bash
# Run all tests
npm test

# Run only integration tests
npm test -- MultiStepApplicationForm.integration

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

## Mocking

The test mocks the following dependencies:
- `useAuth` - Authentication hook
- `useProjects` - Projects data hook
- `useDocumentUpload` - Document upload functionality
- `useActivityLogger` - Activity logging
- `useAutoSaveDraft` - Draft auto-save functionality
- `supabase` - Supabase client (database and storage)

## Notes

- The test uses `@testing-library/react` and `@testing-library/user-event` for component testing
- File uploads are tested using `DataTransfer` API to simulate file selection
- All form steps are tested individually and as part of a complete flow
- The test verifies both successful operations and error handling (validation, file size limits, unsupported types)

