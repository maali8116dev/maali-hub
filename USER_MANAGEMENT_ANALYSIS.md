# User Management: Profiles Table vs Separate Table Analysis

## Current Requirements (from AdminUsers.tsx)

The admin user management page needs:
1. ✅ **id** - Available in profiles
2. ✅ **name** - Available (first_name + last_name in profiles)
3. ❌ **email** - NOT in profiles (stored in auth.users)
4. ✅ **role** - Available in profiles (admin, reviewer, applicant)
5. ✅ **registeredAt** - Available (created_at in profiles)
6. ❌ **applicationsCount** - NOT in profiles (needs COUNT from applications table)
7. ❌ **status** - NOT in profiles (active/suspended)

## Current Profiles Table Schema

```sql
profiles (
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users(id)
  first_name TEXT
  last_name TEXT
  business_name TEXT
  business_sector TEXT
  country TEXT
  bio TEXT
  avatar_url TEXT
  role user_role (admin, reviewer, applicant)
  created_at TIMESTAMP
  updated_at TIMESTAMP
)
```

## Recommendation: Use Profiles Table + Enhancements

**YES, you can use the profiles table**, but you'll need:

### Option 1: Database View (Recommended)
Create a view that joins profiles with auth.users and calculates application counts:

```sql
CREATE VIEW user_management_view AS
SELECT 
  p.id,
  p.user_id,
  COALESCE(p.first_name || ' ' || p.last_name, au.email) AS name,
  au.email,
  p.role,
  p.created_at AS registered_at,
  COALESCE(COUNT(a.id), 0) AS applications_count,
  CASE 
    WHEN au.banned_until IS NOT NULL THEN 'suspended'
    WHEN au.deleted_at IS NOT NULL THEN 'deleted'
    ELSE 'active'
  END AS status
FROM profiles p
LEFT JOIN auth.users au ON p.user_id = au.id
LEFT JOIN applications a ON p.user_id = a.user_id
GROUP BY p.id, p.user_id, p.first_name, p.last_name, au.email, p.role, p.created_at, au.banned_until, au.deleted_at;
```

**Pros:**
- Single query for all user management data
- No schema changes needed
- Uses existing auth.users fields for status
- Calculates application counts automatically

**Cons:**
- Requires RLS policy to allow admins to view auth.users data
- May need a database function for better security

### Option 2: Add Status Column to Profiles

```sql
-- Add status column
ALTER TABLE profiles 
ADD COLUMN status TEXT DEFAULT 'active' 
CHECK (status IN ('active', 'suspended', 'deleted'));

-- Create index
CREATE INDEX idx_profiles_status ON profiles(status);
```

Then query with JOIN:
```sql
SELECT 
  p.*,
  au.email,
  COUNT(a.id) as applications_count
FROM profiles p
LEFT JOIN auth.users au ON p.user_id = au.id
LEFT JOIN applications a ON p.user_id = a.user_id
GROUP BY p.id, au.email;
```

**Pros:**
- Explicit status field
- Can be updated independently of auth.users
- Simpler queries

**Cons:**
- Requires migration
- Status could get out of sync with auth.users

### Option 3: Database Function (Most Secure)

Create a function that admins can call:

```sql
CREATE OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  role user_role,
  registered_at TIMESTAMP,
  applications_count BIGINT,
  status TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    COALESCE(p.first_name || ' ' || p.last_name, au.email) AS name,
    au.email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(COUNT(a.id), 0)::BIGINT AS applications_count,
    CASE 
      WHEN au.banned_until IS NOT NULL THEN 'suspended'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END AS status
  FROM profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  LEFT JOIN applications a ON p.user_id = a.user_id
  WHERE EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  GROUP BY p.id, p.user_id, p.first_name, p.last_name, au.email, p.role, p.created_at, au.banned_until, au.deleted_at;
END;
$$;
```

**Pros:**
- Most secure (uses SECURITY DEFINER)
- Validates admin role
- Encapsulates complex query logic
- Can be called from frontend easily

**Cons:**
- More complex setup
- Requires careful security review

## Recommended Approach

**Use Option 3 (Database Function)** because:
1. ✅ Uses existing profiles table (no new table needed)
2. ✅ Securely accesses auth.users.email
3. ✅ Calculates application counts
4. ✅ Determines status from auth.users metadata
5. ✅ Validates admin permissions
6. ✅ Single function call from frontend

## Implementation Steps

1. Create the database function (migration)
2. Add RLS policy to allow function execution for admins
3. Create a hook `useUsers()` that calls the function
4. Update `AdminUsers.tsx` to use the hook
5. Add suspend/activate functionality (update auth.users.banned_until)

## Alternative: If You Need More User Management Features

If you need features like:
- User activity tracking
- Login history
- Account verification status
- Custom user metadata

Then consider creating a `user_metadata` or `user_settings` table that extends profiles, but keep profiles as the primary table.

