# Testing Guide - Data Fetching and Viewing

This guide covers the testing setup for data fetching and viewing functionality in the Maali Opportunity Hub application.

## Setup

### Installation

The testing dependencies are already added to `package.json`. Install them with:

```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Structure

### Test Files

- **Hook Tests**: `src/hooks/__tests__/`
  - `useProjects.test.ts` - Tests for project data fetching
  - `useProfile.test.ts` - Tests for profile data fetching
  - `useApplications.test.ts` - Tests for application data fetching

- **Component Tests**: `src/pages/__tests__/`
  - `Projects.test.tsx` - Tests for Projects page data viewing
  - `Dashboard.test.tsx` - Tests for Dashboard data viewing

### Test Utilities

- **Setup**: `src/test/setup.ts` - Global test configuration
- **Mocks**: `src/test/mocks/` - MSW handlers and server setup
- **Utils**: `src/test/utils/test-utils.tsx` - Custom render function with providers

## What's Tested

### Data Fetching Hooks

#### `useProjects`
- ✅ Fetches projects successfully
- ✅ Applies category filter
- ✅ Applies status filter
- ✅ Applies search filter
- ✅ Handles pagination correctly
- ✅ Handles errors gracefully
- ✅ Fetches categories
- ✅ Fetches locations
- ✅ Fetches featured projects

#### `useProfile`
- ✅ Fetches profile successfully
- ✅ Returns null when profile doesn't exist (PGRST116)
- ✅ Does not fetch when user is not authenticated
- ✅ Handles other errors by throwing
- ✅ Transforms snake_case to camelCase correctly
- ✅ Updates profile successfully
- ✅ Handles update errors

#### `useApplications`
- ✅ Fetches applications with project details
- ✅ Returns empty array when user has no applications
- ✅ Handles missing project gracefully
- ✅ Maps status correctly (under_review → pending)
- ✅ Does not fetch when user is not authenticated
- ✅ Handles errors gracefully

### Data Viewing Components

#### Projects Page
- ✅ Displays projects when data is loaded
- ✅ Displays loading skeleton while fetching
- ✅ Displays error message when fetch fails
- ✅ Displays empty state when no projects found
- ✅ Displays correct pagination information
- ✅ Filters projects by category
- ✅ Filters projects by search query
- ✅ Clears search query
- ✅ Updates items per page
- ✅ Displays project count correctly

#### Dashboard
- ✅ Displays application statistics correctly
- ✅ Displays loading skeleton while fetching
- ✅ Displays zero stats when no applications
- ✅ Displays recent applications (first 3)
- ✅ Displays empty state when no applications
- ✅ Displays profile completion percentage
- ✅ Displays loading state for profile
- ✅ Displays application status badges
- ✅ Formats dates correctly
- ✅ Displays application sector information
- ✅ Calculates stats correctly for mixed statuses
- ✅ Shows only first 3 applications in recent section

## Mocking Strategy

### Supabase Client

The Supabase client is mocked at the module level in `src/test/setup.ts`. This allows us to:

- Mock database queries
- Test error scenarios
- Test different data states
- Avoid actual database calls during tests

### MSW (Mock Service Worker)

MSW is used to intercept HTTP requests and return mock responses. This is useful for:

- Testing API integration
- Testing error handling
- Testing loading states
- Testing different response scenarios

### React Query

React Query is wrapped in a test QueryClient with:
- `retry: false` - Faster test execution
- `cacheTime: 0` - No caching between tests

## Writing New Tests

### Testing a Data Fetching Hook

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useYourHook } from '../useYourHook';

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

describe('useYourHook', () => {
  it('fetches data successfully', async () => {
    // Mock your dependencies
    vi.mock('@/integrations/supabase/client', () => ({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          // ... chain methods
          single: vi.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        })),
      },
    }));

    const { result } = renderHook(() => useYourHook(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });
});
```

### Testing a Data Viewing Component

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import YourComponent from '../YourComponent';
import { useYourHook } from '@/hooks/useYourHook';

vi.mock('@/hooks/useYourHook');

describe('YourComponent', () => {
  it('displays data when loaded', async () => {
    (useYourHook as any).mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    render(<YourComponent />);

    await waitFor(() => {
      expect(screen.getByText('Expected Content')).toBeInTheDocument();
    });
  });
});
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the user sees and experiences
   - Don't test internal implementation details

2. **Use Descriptive Test Names**
   - Clearly describe what is being tested
   - Use "should" or "it" format

3. **Keep Tests Isolated**
   - Each test should be independent
   - Use `beforeEach` to reset mocks

4. **Test Edge Cases**
   - Empty states
   - Error states
   - Loading states
   - Boundary conditions

5. **Mock External Dependencies**
   - Mock Supabase client
   - Mock React Router
   - Mock analytics services

6. **Use waitFor for Async Operations**
   - Wait for data to load
   - Wait for state updates
   - Wait for DOM updates

## Coverage Goals

- **Hooks**: >90% coverage
- **Components**: >80% coverage
- **Critical Paths**: 100% coverage

## Troubleshooting

### Tests Failing with "Cannot find module"

Make sure all dependencies are installed:
```bash
npm install
```

### Tests Timing Out

Increase timeout in test file:
```typescript
it('your test', async () => {
  // ... test code
}, { timeout: 10000 });
```

### Mock Not Working

Ensure mocks are set up before the component/hook is imported:
```typescript
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));
```

## Next Steps

- Add E2E tests with Playwright or Cypress
- Add visual regression tests
- Add performance tests
- Add accessibility tests

