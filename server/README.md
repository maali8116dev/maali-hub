# Maali Backend API

A modern backend API built with **Hono**, **Drizzle ORM**, and **Supabase Auth**.

## Features

- ⚡ **Fast** - Built with Hono, one of the fastest web frameworks
- 🔒 **Secure** - Supabase JWT authentication middleware
- 📝 **Type-safe** - Full TypeScript support with Zod validation
- 🗄️ **Database** - Drizzle ORM with PostgreSQL (Supabase)
- 🎯 **RESTful** - Clean REST API design

## Tech Stack

- **Hono** - Web framework
- **Drizzle ORM** - Type-safe database queries
- **Supabase** - Authentication & Database
- **Zod** - Schema validation
- **TypeScript** - Type safety

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**Get your Supabase credentials:**

- Go to Supabase Dashboard > Settings > API
- Copy `Project URL` → `SUPABASE_URL`
- Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
- Go to Settings > Database > Connection string > URI → `DATABASE_URL`

### 3. Run the Server

**Development (with hot reload):**

```bash
npm run server:dev
```

**Production:**

```bash
npm run server:start
```

The server will run on `http://localhost:3000`

## API Endpoints

### Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <supabase-jwt-token>
```

### Profiles

- `GET /api/profiles/me` - Get current user's profile
- `GET /api/profiles/:id` - Get profile by ID
- `POST /api/profiles` - Create profile
- `PATCH /api/profiles/me` - Update current user's profile
- `DELETE /api/profiles/me` - Delete current user's profile

### Applications

- `GET /api/applications` - Get all applications for current user
- `GET /api/applications/:id` - Get application by ID
- `GET /api/applications/project/:projectId` - Get applications by project ID
- `POST /api/applications` - Create application
- `PATCH /api/applications/:id` - Update application
- `DELETE /api/applications/:id` - Delete application

### Documents

- `GET /api/documents` - Get all documents for current user
- `GET /api/documents/:id` - Get document by ID
- `GET /api/documents/application/:applicationId` - Get documents for an application
- `POST /api/documents` - Create document
- `DELETE /api/documents/:id` - Delete document

## Usage Example

### From Frontend (React)

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const API_URL = "http://localhost:3000";

async function fetchProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${API_URL}/api/profiles/me`, {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    },
  });

  return response.json();
}

// In your component
const { data: profile } = useQuery({
  queryKey: ["profile"],
  queryFn: fetchProfile,
});
```

## Project Structure

```
server/
├── db/
│   ├── schema.ts          # Drizzle schema definitions
│   ├── index.ts           # Database connection
│   └── config.ts          # Database config
├── queries/               # Database query functions
│   ├── profiles.ts
│   ├── applications.ts
│   └── documents.ts
├── routes/                # API route handlers
│   ├── profiles.ts
│   ├── applications.ts
│   └── documents.ts
├── middleware/
│   └── auth.ts            # Authentication middleware
├── index.ts               # Main app setup
└── server.ts              # Server entry point
```

## Deployment

### Option 1: Node.js Server (VPS/Cloud)

1. Build and run:

```bash
npm run server:start
```

2. Use PM2 for process management:

```bash
npm install -g pm2
pm2 start npm --name "maali-api" -- run server:start
```

### Option 2: Cloudflare Workers

Hono works great on Cloudflare Workers! See [Hono Cloudflare docs](https://hono.dev/getting-started/cloudflare-workers).

### Option 3: Vercel/Netlify Functions

Hono can be deployed as serverless functions. See [Hono deployment docs](https://hono.dev/getting-started/vercel).

## Development Tips

- Use `npm run db:studio` to view your database with Drizzle Studio
- All routes are type-safe with Zod validation
- Authentication is handled automatically via middleware
- Error handling is centralized in `index.ts`
