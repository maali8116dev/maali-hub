import { http, HttpResponse } from 'msw';

// Mock data
const mockProjects = [
  {
    id: 1,
    title: 'AgriTech Innovation Fund',
    description: 'Supporting innovative agricultural technology solutions',
    sector: 'Agriculture',
    status: 'open',
    deadline: '2024-12-31',
    funding_amount: '$50,000',
    location: 'Ghana',
    image_url: null,
    requirements: 'Must be a registered business',
    eligibility_criteria: 'African entrepreneurs',
    application_fee: '100',
    max_applicants: 50,
    current_applicants: 12,
    featured: true,
    created_by: 'admin-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Tech Startup Grant',
    description: 'Funding for technology startups',
    sector: 'Technology',
    status: 'open',
    deadline: '2024-11-30',
    funding_amount: '$75,000',
    location: 'Nigeria',
    image_url: null,
    requirements: 'Tech startup',
    eligibility_criteria: 'Early stage startups',
    application_fee: '150',
    max_applicants: 30,
    current_applicants: 8,
    featured: false,
    created_by: 'admin-123',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

const mockProfile = {
  id: 'profile-123',
  user_id: 'user-123',
  first_name: 'John',
  last_name: 'Doe',
  business_name: 'Tech Solutions',
  business_sector: 'Technology',
  country: 'Ghana',
  bio: 'Entrepreneur and innovator',
  avatar_url: null,
  role: 'applicant',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockApplications = [
  {
    id: 'app-1',
    user_id: 'user-123',
    project_id: 1,
    company_name: 'Tech Solutions',
    contact_email: 'john@tech.com',
    contact_phone: '+1234567890',
    project_description: 'Innovative tech solution',
    funding_amount_requested: '$50,000',
    status: 'pending',
    location: 'Ghana',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
];

export const handlers = [
  // Mock Supabase REST API for projects
  http.get('*/rest/v1/projects', ({ request }) => {
    const url = new URL(request.url);
    const sector = url.searchParams.get('sector');
    const status = url.searchParams.get('status');
    const location = url.searchParams.get('location');
    const search = url.searchParams.get('or');

    let filteredProjects = [...mockProjects];

    if (sector) {
      filteredProjects = filteredProjects.filter((p) => p.sector === sector);
    }
    if (status) {
      filteredProjects = filteredProjects.filter((p) => p.status === status);
    }
    if (location) {
      filteredProjects = filteredProjects.filter((p) => p.location === location);
    }
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredProjects = filteredProjects.filter(
        (p) =>
          p.title.toLowerCase().includes(searchTerm) ||
          p.description.toLowerCase().includes(searchTerm)
      );
    }

    return HttpResponse.json(filteredProjects, {
      headers: {
        'content-range': `0-${filteredProjects.length - 1}/${filteredProjects.length}`,
      },
    });
  }),

  // Mock Supabase REST API for profiles
  http.get('*/rest/v1/profiles', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (userId === 'eq.user-123') {
      return HttpResponse.json([mockProfile]);
    }

    return HttpResponse.json([]);
  }),

  // Mock Supabase REST API for applications
  http.get('*/rest/v1/applications', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (userId === 'eq.user-123') {
      return HttpResponse.json(mockApplications);
    }

    return HttpResponse.json([]);
  }),

  // Mock Supabase auth
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-token',
      user: { id: 'user-123', email: 'test@example.com' },
    });
  }),

  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'user-123',
      email: 'test@example.com',
    });
  }),
];









