/**
 * Seed script for users, applicants, reviewers, reviewer assignments, and review scores
 * 
 * This script creates:
 * - 1 Admin user
 * - 1 Partner user (can create opportunities)
 * - 5 Reviewer users (assigned to different sectors)
 * - 10 Applicant users
 * - 20 Applications from applicants (distributed across sectors)
 * - Reviewer assignments using the actual RPC function (to test assignment logic)
 * - Review scores for ~40% of assignments (simulating completed reviews with varied scores)
 * 
 * Usage:
 *   node scripts/seed-users-and-reviewers.js
 *   node scripts/seed-users-and-reviewers.js --local
 *   node scripts/seed-users-and-reviewers.js --help
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env
 *   - Or pass them as environment variables
 *   - Projects must be seeded first (run: npm run supabase:seed)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { lookup } from 'node:dns/promises';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const args = new Set(process.argv.slice(2));
const useLocal = args.has('--local');

if (args.has('--help') || args.has('-h')) {
  console.log('Usage:');
  console.log('  node scripts/seed-users-and-reviewers.js');
  console.log('  node scripts/seed-users-and-reviewers.js --local');
  console.log('');
  console.log('Options:');
  console.log('  --local   Use local Supabase URL and service role key');
  console.log('  --help    Show this help message');
  console.log('');
  console.log('Env vars (remote/default):');
  console.log('  SUPABASE_URL or VITE_SUPABASE_URL');
  console.log('  SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY');
  console.log('');
  console.log('Env vars (local mode):');
  console.log('  SUPABASE_LOCAL_URL (optional, default: http://127.0.0.1:54321)');
  console.log('  SUPABASE_LOCAL_SERVICE_ROLE_KEY (preferred)');
  console.log('  SUPABASE_SERVICE_ROLE_KEY (fallback)');
  process.exit(0);
}

function getEnvVar(...keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
    if (trimmed) return trimmed;
  }
  return undefined;
}

const SUPABASE_URL = useLocal
  ? getEnvVar('SUPABASE_LOCAL_URL') || 'http://127.0.0.1:54321'
  : getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = useLocal
  ? getEnvVar('SUPABASE_LOCAL_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY')
  : getEnvVar('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  if (useLocal) {
    console.error('\nLocal mode requires:');
    console.error('   SUPABASE_LOCAL_SERVICE_ROLE_KEY=your_local_service_role_key');
    console.error('   (optional) SUPABASE_LOCAL_URL=http://127.0.0.1:54321');
  } else {
    console.error('\nPlease set these in your .env file:');
    console.error('   VITE_SUPABASE_URL=your_supabase_url');
    console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    console.error('\nOr use:');
    console.error('   SUPABASE_URL=your_supabase_url');
    console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  }
  process.exit(1);
}

let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(SUPABASE_URL);
} catch {
  console.error('❌ Invalid SUPABASE_URL format:', SUPABASE_URL);
  console.error('   Example: https://your-project-ref.supabase.co');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifySupabaseHost() {
  // Skip DNS preflight in local mode.
  if (useLocal) return;

  try {
    await lookup(parsedSupabaseUrl.hostname);
  } catch (error) {
    console.error('❌ Supabase host is not reachable:', parsedSupabaseUrl.hostname);
    console.error('   This usually means SUPABASE_URL is incorrect or points to a deleted project.');
    console.error('   Update .env with the correct URL and rerun.');
    console.error('\n   Checked URL:', SUPABASE_URL);
    process.exit(1);
  }
}

// Helper to get existing user by email
async function getUserByEmail(email) {
  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    return users?.users?.find(u => u.email === email) || null;
  } catch (error) {
    return null;
  }
}

// Helper to delete user if exists (for idempotent seed runs)
async function deleteUserIfExists(email) {
  try {
    const existingUser = await getUserByEmail(email);
    
    if (existingUser) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        console.log(`   ⚠️  Failed to delete existing user ${email}: ${deleteError.message}`);
        return false; // Return false if deletion failed
      } else {
        console.log(`   🗑️  Deleted existing user: ${email}`);
        return true; // Return true if deletion succeeded
      }
    }
    return true; // User doesn't exist, consider it "successful"
  } catch (error) {
    console.log(`   ⚠️  Error checking for user ${email}:`, error.message);
    return false;
  }
}

// Helper to update existing user
async function updateExistingUser(userId, userData) {
  const { password, firstName, lastName, role } = userData;
  
  // Update auth user metadata
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: password || 'TestPassword123!',
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: role,
    },
  });

  if (updateError) {
    console.error(`   ⚠️  Failed to update user metadata:`, updateError.message);
    // Continue anyway - profile update is more important
  }

  return userId;
}

// Helper to create a user with profile
async function createUserWithProfile(userData) {
  const { email, password, firstName, lastName, role, businessName, country, bio } = userData;
  
  // Check if user already exists
  const existingUser = await getUserByEmail(email);
  
  let userId;
  
  if (existingUser) {
    // User exists - try to delete first
    const deleted = await deleteUserIfExists(email);
    
    if (!deleted) {
      // Deletion failed (likely due to foreign key constraints from applications, etc.)
      console.log(`   ℹ️  User ${email} exists and cannot be deleted (may have related data). Updating instead...`);
      userId = existingUser.id;
      
      // Update existing user
      await updateExistingUser(userId, userData);
    } else {
      // User was deleted successfully, create new one
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: password || 'TestPassword123!',
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role: role,
        },
      });

      if (authError) {
        // If creation fails with email_exists, user was recreated elsewhere
        if (authError.code === 'email_exists' || authError.message?.includes('already been registered')) {
          console.log(`   ℹ️  User ${email} was recreated. Fetching existing user...`);
          const recreatedUser = await getUserByEmail(email);
          if (recreatedUser) {
            userId = recreatedUser.id;
            await updateExistingUser(userId, userData);
          } else {
            throw new Error(`Failed to find user ${email} after recreation`);
          }
        } else {
          console.error(`   ❌ User ${email} creation failed:`, authError.message);
          throw authError;
        }
      } else {
        userId = authData.user.id;
      }
    }
  } else {
    // User doesn't exist, create new one
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: password || 'TestPassword123!',
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role,
      },
    });

    if (authError) {
      // Handle case where user was created between check and creation
      if (authError.code === 'email_exists' || authError.message?.includes('already been registered')) {
        console.log(`   ℹ️  User ${email} was created elsewhere. Fetching existing user...`);
        const createdUser = await getUserByEmail(email);
        if (createdUser) {
          userId = createdUser.id;
          await updateExistingUser(userId, userData);
        } else {
          throw new Error(`Failed to find user ${email} after creation`);
        }
      } else {
        console.error(`   ❌ User ${email} creation failed:`, authError.message);
        throw authError;
      }
    } else {
      userId = authData.user.id;
    }
  }

  // Create/update profile (this will always work with upsert)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      role: role,
      business_name: businessName,
      country: country,
      bio: bio,
    }, {
      onConflict: 'user_id',
    });

  if (profileError) {
    console.error(`   ❌ Failed to create/update profile for ${email}:`, profileError.message);
    throw profileError;
  }

  console.log(`   ✅ User ${email} ready (${existingUser ? 'updated' : 'created'})`);
  return userId;
}

// Helper to get sector ID by name
async function getSectorId(sectorName) {
  const { data, error } = await supabase
    .from('sectors')
    .select('id')
    .eq('name', sectorName)
    .single();

  if (error || !data) {
    throw new Error(`Sector "${sectorName}" not found. Make sure sectors are seeded first.`);
  }

  return data.id;
}

// Helper to assign reviewer to sector
async function assignReviewerToSector(reviewerId, sectorName) {
  const sectorId = await getSectorId(sectorName);
  
  const { error } = await supabase
    .from('reviewer_sectors')
    .upsert({
      reviewer_id: reviewerId,
      sector_id: sectorId,
    }, {
      onConflict: 'reviewer_id,sector_id',
    });

  if (error) {
    console.error(`   ⚠️  Failed to assign reviewer to ${sectorName}:`, error.message);
  }
}

// Helper to create application (matches current applications schema)
async function createApplication(applicationData) {
  const {
    userId,
    opportunityId,
    companyName,
    contactEmail,
    contactPhone,
    location,
    projectDescription,
  } = applicationData;

  // Map legacy "location" like "City, Country" into the new fields
  let cityRegion = null;
  let countryOfResidence = null;

  if (location) {
    const parts = location
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 1) {
      countryOfResidence = parts[0];
    } else if (parts.length >= 2) {
      cityRegion = parts[0];
      countryOfResidence = parts[parts.length - 1];
    }
  }

  // Idempotency + unique (user_id, opportunity_id) constraint:
  // If an application already exists for this user/opportunity, reuse it
  const { data: existingApp, error: existingFetchError } = await supabase
    .from('applications')
    .select('id')
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId)
    .maybeSingle();

  if (existingFetchError) {
    console.log(
      `   ⚠️  Warning: could not check for existing application (user_id=${userId}, opportunity_id=${opportunityId}):`,
      existingFetchError.message
    );
  }

  if (existingApp?.id) {
    console.log(
      `   ℹ️  Application already exists for user/opportunity, reusing existing id: ${existingApp.id}`
    );
    return existingApp.id;
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      opportunity_id: opportunityId,
      organization_name: companyName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      city_region: cityRegion,
      country_of_residence: countryOfResidence,
      project_summary: projectDescription,
      status: 'pending',
      is_draft: false,
    })
    .select()
    .single();

  if (error) {
    // Handle unique (user_id, opportunity_id) constraint defensively in case of race
    if (
      error.code === '23505' ||
      error.message?.includes('idx_applications_unique_user_project')
    ) {
      console.log(
        `   ℹ️  Duplicate application detected for user/opportunity, attempting to reuse existing record`
      );

      const { data: existingAfterInsert, error: lookupError } = await supabase
        .from('applications')
        .select('id')
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId)
        .maybeSingle();

      if (!lookupError && existingAfterInsert?.id) {
        console.log(
          `   ℹ️  Reusing existing application id after duplicate error: ${existingAfterInsert.id}`
        );
        return existingAfterInsert.id;
      }

      console.log(
        `   ⚠️  Duplicate error occurred but existing application could not be fetched; rethrowing original error`
      );
    }

    console.error(`   ❌ Failed to create application:`, error.message);
    throw error;
  }

  return data.id;
}

// Helper to assign reviewers to application
async function assignReviewersToApplication(applicationId, reviewerIds) {
  const assignments = reviewerIds.map(reviewerId => ({
    application_id: applicationId,
    reviewer_id: reviewerId,
    status: 'pending',
  }));

  const { error } = await supabase
    .from('application_assignments')
    .insert(assignments);

  if (error) {
    console.error(`   ⚠️  Failed to assign reviewers:`, error.message);
  } else {
    console.log(`   ✅ Assigned ${reviewerIds.length} reviewer(s) to application`);
  }
}

// Get open opportunities
async function getOpenOpportunities() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, sector_id, sectors:sector_id(name)')
    .eq('status', 'open')
    .limit(20); // Get more opportunities to ensure we have enough with sector_id

  if (error) {
    throw error;
  }

  // Filter to only opportunities with sector_id (required for reviewer assignment)
  const opportunitiesWithSector = (data || []).filter(o => o.sector_id !== null);
  
  if (opportunitiesWithSector.length === 0) {
    console.log('   ⚠️  Warning: No opportunities found with sector_id set.');
    console.log('   💡 Tip: Ensure opportunities have sector_id populated.');
  }

  return opportunitiesWithSector.length > 0 ? opportunitiesWithSector : (data || []);
}

// Helper to cleanup existing seed data (for idempotent runs)
async function cleanupSeedData() {
  console.log('🧹 Cleaning up existing seed data...\n');
  
  try {
    // Delete applications from seed users
    const { error: appError } = await supabase
      .from('applications')
      .delete()
      .in('contact_email', [
        'applicant1@maali.test',
        'applicant2@maali.test',
        'applicant3@maali.test',
        'applicant4@maali.test',
        'applicant5@maali.test',
        'applicant6@maali.test',
        'applicant7@maali.test',
        'applicant8@maali.test',
        'applicant9@maali.test',
        'applicant10@maali.test',
      ]);
    
    if (appError) {
      console.log(`   ⚠️  Error deleting applications: ${appError.message}`);
    } else {
      console.log('   ✅ Cleaned up existing applications');
    }

    // Delete seed users (this will cascade delete profiles and assignments)
    const seedEmails = [
      'admin@maali.test',
      'partner@maali.test',
      'reviewer.tech@maali.test',
      'reviewer.agriculture@maali.test',
      'reviewer.fintech@maali.test',
      'reviewer.multi@maali.test',
      'reviewer.tech2@maali.test',
      'applicant1@maali.test', // Used by notification integration tests
      'applicant2@maali.test',
      'applicant3@maali.test',
      'applicant4@maali.test',
      'applicant5@maali.test',
      'applicant6@maali.test',
      'applicant7@maali.test',
      'applicant8@maali.test',
      'applicant9@maali.test',
      'applicant10@maali.test',
    ];

    const { data: users } = await supabase.auth.admin.listUsers();
    let deletedCount = 0;
    
    for (const email of seedEmails) {
      const user = users?.users?.find(u => u.email === email);
      if (user) {
        const { error } = await supabase.auth.admin.deleteUser(user.id);
        if (!error) {
          deletedCount++;
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`   ✅ Deleted ${deletedCount} existing seed users\n`);
    } else {
      console.log('   ℹ️  No existing seed users found\n');
    }

    // Delete seed partner org if it exists
    const { error: partnerDeleteError } = await supabase
      .from('partners')
      .delete()
      .eq('name', 'Maali Test Partner Org');

    if (partnerDeleteError) {
      console.log(`   ⚠️  Error deleting seed partner org: ${partnerDeleteError.message}\n`);
    } else {
      console.log('   ✅ Cleaned up existing seed partner org (if any)\n');
    }
  } catch (error) {
    console.log(`   ⚠️  Cleanup error (continuing anyway): ${error.message}\n`);
  }
}

async function main() {
  console.log('🌱 Starting seed data creation...\n');

  try {
    await verifySupabaseHost();

    // Cleanup existing seed data first
    await cleanupSeedData();

    // Step 1: Create Admin User
    console.log('📝 Step 1: Creating admin user...');
    const adminId = await createUserWithProfile({
      email: 'admin@maali.test',
      password: 'Admin123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      country: 'Ghana',
      bio: 'System administrator',
    });
    console.log(`   ✅ Created admin: admin@maali.test (${adminId.substring(0, 8)}...)\n`);

    // Step 1.5: Create Partner user
    console.log('📝 Step 1.5: Creating partner user...');
    const partnerUserId = await createUserWithProfile({
      email: 'partner@maali.test',
      firstName: 'Patricia',
      lastName: 'Partner',
      role: 'partner',
      businessName: 'Maali Test Partner Org',
      country: 'Ghana',
      bio: 'Seed partner account used to create and manage opportunities in test environments.',
    });
    console.log(`   ✅ Created partner: partner@maali.test (${partnerUserId.substring(0, 8)}...)\n`);

    // Step 1.6: Create or link Partner org and connect profile.partner_id
    console.log('📝 Step 1.6: Linking partner user to partner organization...');
    // Create a partner org row if it doesn't exist, or fetch existing one
    const { data: existingPartner, error: fetchPartnerError } = await supabase
      .from('partners')
      .select('id')
      .eq('name', 'Maali Test Partner Org')
      .maybeSingle();

    if (fetchPartnerError) {
      console.log(`   ⚠️  Error checking existing partner org: ${fetchPartnerError.message}`);
    }

  let partnerOrgId = existingPartner?.id;

    if (!partnerOrgId) {
      const { data: partnerInsert, error: partnerInsertError } = await supabase
        .from('partners')
        .insert({
          name: 'Maali Test Partner Org',
          description: 'Seed partner organization used to create and manage opportunities in test environments.',
          sector: 'Strategic',
          status: 'active',
          user_id: partnerUserId,
        })
        .select('id')
        .single();

      if (partnerInsertError) {
        console.log(`   ⚠️  Error creating partner org: ${partnerInsertError.message}`);
      } else {
        partnerOrgId = partnerInsert.id;
        console.log(`   ✅ Created partner org with id ${partnerOrgId}`);
      }
    } else {
      console.log(`   ℹ️  Found existing partner org with id ${partnerOrgId}`);
    }

    // Link partner profile to partner org via profiles.partner_id
    if (partnerOrgId) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ partner_id: partnerOrgId })
        .eq('user_id', partnerUserId);

      if (profileUpdateError) {
        console.log(`   ⚠️  Error linking partner profile to org: ${profileUpdateError.message}`);
      } else {
        console.log(`   ✅ Linked partner profile to org (partner_id=${partnerOrgId})\n`);
      }
    } else {
      console.log('   ⚠️  Skipped linking partner profile to org because partnerOrgId could not be determined\n');
    }

    // Step 2: Create Reviewers
    console.log('📝 Step 2: Creating reviewer users...');
    const reviewers = [
      {
        email: 'reviewer.tech@maali.test',
        firstName: 'Sarah',
        lastName: 'Tech',
        role: 'reviewer',
        sectors: ['Technology'],
        country: 'Ghana',
        bio: 'Technology expert with 10+ years in software development',
      },
      {
        email: 'reviewer.agriculture@maali.test',
        firstName: 'Kwame',
        lastName: 'Agri',
        role: 'reviewer',
        sectors: ['Agriculture'],
        country: 'Ghana',
        bio: 'Agricultural specialist focusing on sustainable farming',
      },
      {
        email: 'reviewer.fintech@maali.test',
        firstName: 'Ama',
        lastName: 'Finance',
        role: 'reviewer',
        sectors: ['FinTech'],
        country: 'Nigeria',
        bio: 'FinTech consultant with expertise in financial inclusion',
      },
      {
        email: 'reviewer.multi@maali.test',
        firstName: 'David',
        lastName: 'Multi',
        role: 'reviewer',
        sectors: ['Technology', 'Agriculture'], // Multi-sector reviewer
        country: 'Kenya',
        bio: 'Experienced reviewer across multiple sectors',
      },
      {
        email: 'reviewer.tech2@maali.test',
        firstName: 'Grace',
        lastName: 'Innovation',
        role: 'reviewer',
        sectors: ['Technology'],
        country: 'South Africa',
        bio: 'Tech innovation specialist',
      },
    ];

    const reviewerIds = [];
    for (const reviewer of reviewers) {
      const { sectors, ...userData } = reviewer;
      const reviewerId = await createUserWithProfile(userData);
      reviewerIds.push(reviewerId);
      
      // Assign reviewer to sectors
      for (const sector of sectors) {
        await assignReviewerToSector(reviewerId, sector);
      }
      
      console.log(`   ✅ Created reviewer: ${reviewer.email} (${reviewerId.substring(0, 8)}...) - Sectors: ${sectors.join(', ')}`);
    }
    console.log(`\n   ✅ Created ${reviewers.length} reviewers\n`);

    // Step 3: Create Applicants
    console.log('📝 Step 3: Creating applicant users...');
    const applicants = [
      {
        email: 'applicant1@maali.test',
        firstName: 'John',
        lastName: 'Entrepreneur',
        businessName: 'TechStart Ghana',
        country: 'Ghana',
        bio: 'Building innovative tech solutions',
        // Note: This user is used by notification integration tests
      },
      {
        email: 'applicant2@maali.test',
        firstName: 'Mary',
        lastName: 'Innovator',
        businessName: 'AgriSolutions Ltd',
        country: 'Nigeria',
        bio: 'Sustainable agriculture solutions',
      },
      {
        email: 'applicant3@maali.test',
        firstName: 'Peter',
        lastName: 'Developer',
        businessName: 'FinTech Africa',
        country: 'Kenya',
        bio: 'Financial technology for inclusion',
      },
      {
        email: 'applicant4@maali.test',
        firstName: 'Jane',
        lastName: 'Creator',
        businessName: 'EduTech Solutions',
        country: 'Ghana',
        bio: 'Educational technology platform',
      },
      {
        email: 'applicant5@maali.test',
        firstName: 'Michael',
        lastName: 'Builder',
        businessName: 'Green Energy Co',
        country: 'South Africa',
        bio: 'Renewable energy solutions',
      },
      {
        email: 'applicant6@maali.test',
        firstName: 'Fatima',
        lastName: 'Founder',
        businessName: 'HealthTech Innovations',
        country: 'Nigeria',
        bio: 'Healthcare technology platform',
      },
      {
        email: 'applicant7@maali.test',
        firstName: 'James',
        lastName: 'Farmer',
        businessName: 'Smart Farms Ltd',
        country: 'Ghana',
        bio: 'IoT solutions for agriculture',
      },
      {
        email: 'applicant8@maali.test',
        firstName: 'Patricia',
        lastName: 'Tech',
        businessName: 'MobilePay Solutions',
        country: 'Kenya',
        bio: 'Mobile payment platform',
      },
      {
        email: 'applicant9@maali.test',
        firstName: 'Robert',
        lastName: 'Innovator',
        businessName: 'AI Solutions Africa',
        country: 'South Africa',
        bio: 'AI and ML solutions',
      },
      {
        email: 'applicant10@maali.test',
        firstName: 'Linda',
        lastName: 'Entrepreneur',
        businessName: 'E-commerce Hub',
        country: 'Ghana',
        bio: 'E-commerce platform for SMEs',
      },
    ];

    const applicantIds = [];
    for (const applicant of applicants) {
      const applicantId = await createUserWithProfile({
        ...applicant,
        role: 'applicant',
      });
      applicantIds.push(applicantId);
      // Store userId in applicant object for later reference
      applicant.userId = applicantId;
      console.log(`   ✅ Created applicant: ${applicant.email} (${applicantId.substring(0, 8)}...)`);
    }
    console.log(`\n   ✅ Created ${applicants.length} applicants\n`);

    // Step 4: Get open opportunities (with sector_id) for creating applications
    console.log('📝 Step 4: Fetching open opportunities...');
    let opportunities = await getOpenOpportunities();
    if (opportunities.length === 0) {
      console.log('   ⚠️  No open opportunities found. Please seed opportunities first using supabase/seed.sql or scripts/seed.js');
      return;
    }

    // Step 5: Create Applications and Assign Reviewers
    console.log('📝 Step 5: Creating applications and assigning reviewers...');
    
    // Template application content - we'll reuse this with different applicants
    const applicationTemplates = [
      {
        companyName: 'TechStart Solutions',
        contactPhone: '+233 24 123 4567',
        location: 'Accra, Ghana',
        projectDescription: 'We are building an innovative mobile app for small businesses to manage inventory and sales.',
        fundingAmount: '$50,000',
      },
      {
        companyName: 'AgriTech Innovations',
        contactPhone: '+234 80 123 4567',
        location: 'Lagos, Nigeria',
        projectDescription: 'Sustainable farming solutions using IoT sensors to optimize crop yields and reduce water waste.',
        fundingAmount: '$25,000',
      },
      {
        companyName: 'FinTech Solutions',
        contactPhone: '+254 70 123 4567',
        location: 'Nairobi, Kenya',
        projectDescription: 'Mobile banking solution for unbanked populations in rural areas with offline capabilities.',
        fundingAmount: '$75,000',
      },
      {
        companyName: 'EduTech Platform',
        contactPhone: '+233 20 123 4567',
        location: 'Kumasi, Ghana',
        projectDescription: 'Online learning platform for rural schools with offline capabilities and local language support.',
        fundingAmount: '$45,000',
      },
      {
        companyName: 'Green Energy Solutions',
        contactPhone: '+27 11 123 4567',
        location: 'Cape Town, South Africa',
        projectDescription: 'Solar panel installation and financing for low-income households with flexible payment plans.',
        fundingAmount: '$90,000',
      },
      {
        companyName: 'HealthTech Platform',
        contactPhone: '+234 90 123 4567',
        location: 'Abuja, Nigeria',
        projectDescription: 'Telemedicine platform connecting patients with doctors in remote areas via video consultations.',
        fundingAmount: '$65,000',
      },
      {
        companyName: 'Smart Agriculture Systems',
        contactPhone: '+233 54 123 4567',
        location: 'Tamale, Ghana',
        projectDescription: 'Smart irrigation system using AI to optimize water usage and predict crop yields.',
        fundingAmount: '$60,000',
      },
      {
        companyName: 'Mobile Payment Gateway',
        contactPhone: '+254 72 123 4567',
        location: 'Mombasa, Kenya',
        projectDescription: 'Mobile money platform for cross-border payments with low transaction fees.',
        fundingAmount: '$55,000',
      },
      {
        companyName: 'AI Solutions Hub',
        contactPhone: '+27 21 123 4567',
        location: 'Johannesburg, South Africa',
        projectDescription: 'AI and machine learning solutions for African businesses with local language processing.',
        fundingAmount: '$100,000',
      },
      {
        companyName: 'E-commerce Marketplace',
        contactPhone: '+233 50 123 4567',
        location: 'Tema, Ghana',
        projectDescription: 'E-commerce platform connecting African SMEs with local and international markets.',
        fundingAmount: '$40,000',
      },
      {
        companyName: 'Tech Innovation Lab',
        contactPhone: '+234 81 123 4567',
        location: 'Port Harcourt, Nigeria',
        projectDescription: 'Innovative tech solutions for African startups with mentorship and funding support.',
        fundingAmount: '$50,000',
      },
      {
        companyName: 'Sustainable Farms Co',
        contactPhone: '+254 73 123 4567',
        location: 'Kisumu, Kenya',
        projectDescription: 'Sustainable agriculture solutions focusing on organic farming and market access.',
        fundingAmount: '$30,000',
      },
      {
        companyName: 'Digital Banking App',
        contactPhone: '+27 12 123 4567',
        location: 'Pretoria, South Africa',
        projectDescription: 'Digital banking application for underserved communities with financial literacy features.',
        fundingAmount: '$80,000',
      },
      {
        companyName: 'Learning Management System',
        contactPhone: '+233 55 123 4567',
        location: 'Takoradi, Ghana',
        projectDescription: 'Comprehensive learning management system for schools and universities across Africa.',
        fundingAmount: '$45,000',
      },
      {
        companyName: 'Renewable Energy Co',
        contactPhone: '+234 82 123 4567',
        location: 'Kano, Nigeria',
        projectDescription: 'Renewable energy solutions including solar, wind, and hydro power for rural communities.',
        fundingAmount: '$95,000',
      },
      {
        companyName: 'Healthcare Management System',
        contactPhone: '+254 74 123 4567',
        location: 'Eldoret, Kenya',
        projectDescription: 'Healthcare management system for clinics and hospitals with patient records and scheduling.',
        fundingAmount: '$70,000',
      },
      {
        companyName: 'Precision Agriculture Tech',
        contactPhone: '+233 56 123 4567',
        location: 'Sunyani, Ghana',
        projectDescription: 'Precision agriculture technology using drones and sensors for crop monitoring.',
        fundingAmount: '$55,000',
      },
      {
        companyName: 'Blockchain Payment System',
        contactPhone: '+27 13 123 4567',
        location: 'Durban, South Africa',
        projectDescription: 'Blockchain-based payment system for secure and transparent financial transactions.',
        fundingAmount: '$85,000',
      },
      {
        companyName: 'EdTech Mobile App',
        contactPhone: '+234 83 123 4567',
        location: 'Ibadan, Nigeria',
        projectDescription: 'Mobile educational app for students with interactive lessons and exam preparation.',
        fundingAmount: '$35,000',
      },
      {
        companyName: 'Clean Energy Initiative',
        contactPhone: '+254 75 123 4567',
        location: 'Nakuru, Kenya',
        projectDescription: 'Clean energy initiative providing solar power solutions to off-grid communities.',
        fundingAmount: '$60,000',
      },
    ];

    // Map opportunities to sectors for better assignment
    const opportunitySectorMap = new Map();
    opportunities.forEach(opp => {
      const sectorName = opp.sectors?.name || 'Technology';
      if (!opportunitySectorMap.has(sectorName)) {
        opportunitySectorMap.set(sectorName, []);
      }
      opportunitySectorMap.get(sectorName).push(opp);
    });

    // Create 20 applications - distribute across applicants and opportunities
    const applicationIds = [];
    let applicantIndex = 0;
    let templateIndex = 0;

    // Create 20 applications to thoroughly test the assignment system
    for (let i = 0; i < 20; i++) {
      // Cycle through applicants
      const currentApplicant = applicants[applicantIndex % applicants.length];
      applicantIndex++;

      // Select opportunity based on sector distribution
      // Technology: 40%, Agriculture: 30%, FinTech: 30%
      let sectorName;
      const rand = Math.random();
      if (rand < 0.4) {
        sectorName = 'Technology';
      } else if (rand < 0.7) {
        sectorName = 'Agriculture';
      } else {
        sectorName = 'FinTech';
      }

      // Get an opportunity from the selected sector
      const sectorOpportunities =
        opportunitySectorMap.get(sectorName) ||
        opportunitySectorMap.get('Technology') ||
        opportunities;
      const opportunity = sectorOpportunities[i % sectorOpportunities.length];
      
      if (!opportunity) continue;

      // Use template content but customize for current applicant
      const template = applicationTemplates[templateIndex % applicationTemplates.length];
      templateIndex++;

      const applicationId = await createApplication({
        userId: currentApplicant.userId,
        opportunityId: opportunity.id,
        companyName: template.companyName,
        contactEmail: currentApplicant.email,
        contactPhone: template.contactPhone,
        location: template.location,
        projectDescription: template.projectDescription,
        fundingAmount: template.fundingAmount,
      });
      
      applicationIds.push(applicationId);
      console.log(
        `   ✅ Created application ${i + 1}/20: ${template.companyName} by ${currentApplicant.email} for "${opportunity.title}" (${sectorName})`
      );

      // Use the RPC function to auto-assign reviewers (this tests the actual assignment logic)
      try {
        // Verify opportunity has sector_id before attempting assignment
        if (!opportunity.sector_id) {
          console.log(
            `   ⚠️  Skipping assignment: Opportunity "${opportunity.title}" has no sector_id (only has sector: ${opportunity.sectors?.name || 'unknown'})`
          );
          continue;
        }

        const { data: assignmentData, error: assignError } = await supabase.rpc(
          'assign_reviewers_to_application',
          {
            p_application_id: applicationId,
            p_num_reviewers: 2, // Request 2 reviewers
          }
        );

        if (assignError) {
          console.log(`   ⚠️  Auto-assignment failed for ${template.companyName}: ${assignError.message}`);
          console.log(`       Error code: ${assignError.code}, Details: ${JSON.stringify(assignError)}`);
        } else if (assignmentData && assignmentData.length > 0) {
          console.log(`   ✅ Auto-assigned ${assignmentData.length} reviewer(s) via RPC function`);
        } else {
          console.log(`   ⚠️  No reviewers assigned (RPC returned empty array - may need more reviewers for ${sectorName})`);
        }
      } catch (error) {
        console.log(`   ⚠️  Assignment error: ${error.message}`);
        console.log(`       Full error: ${JSON.stringify(error, null, 2)}`);
      }
    }

    console.log(`\n   ✅ Created ${applicationIds.length} applications\n`);

    // Step 6.5: Add documents to applications
    console.log('📄 Step 6.5: Adding documents to applications...');
    const testFilesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'test', 'files');
    const testFiles = [
      { name: 'test-document.pdf', mimeType: 'application/pdf' },
      { name: 'test-document.doc', mimeType: 'application/msword' },
      { name: 'test-document.txt.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'text-document.txt', mimeType: 'text/plain' },
    ];

    let documentsAdded = 0;
    for (let i = 0; i < applicationIds.length; i++) {
      const applicationId = applicationIds[i];
      
      // Get application details to find user_id and opportunity_id
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('user_id, opportunity_id')
        .eq('id', applicationId)
        .single();

      if (appError || !application) {
        console.log(`   ⚠️  Could not find application ${applicationId}, skipping documents`);
        continue;
      }

      // Add 1-3 random documents to each application
      const numDocs = Math.floor(Math.random() * 3) + 1; // 1-3 documents
      const selectedFiles = testFiles
        .sort(() => Math.random() - 0.5)
        .slice(0, numDocs);

      for (const testFile of selectedFiles) {
        try {
          const filePath = join(testFilesDir, testFile.name);
          const fileBuffer = readFileSync(filePath);
          
          // Generate unique file path for storage
          const timestamp = Date.now() + Math.floor(Math.random() * 1000); // Add randomness to avoid collisions
          const sanitizedFileName = testFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const storagePath = `${application.user_id}/${timestamp}_${sanitizedFileName}`;

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('application-docs')
            .upload(storagePath, fileBuffer, {
              cacheControl: '3600',
              upsert: false,
              contentType: testFile.mimeType,
            });

          if (uploadError) {
            console.log(`   ⚠️  Failed to upload ${testFile.name} for application ${applicationId}: ${uploadError.message}`);
            continue;
          }

          // Create document entry in database
          const { error: docError } = await supabase
            .from('application_documents')
            .insert({
              user_id: application.user_id,
              application_id: applicationId,
              opportunity_id: application.opportunity_id,
              file_name: testFile.name,
              file_path: storagePath,
              file_size: fileBuffer.length,
              file_type: testFile.mimeType,
              is_library_document: false,
            });

          if (docError) {
            console.log(`   ⚠️  Failed to create document record for ${testFile.name}: ${docError.message}`);
            // Try to clean up uploaded file
            await supabase.storage.from('application-docs').remove([storagePath]);
            continue;
          }

          documentsAdded++;
        } catch (error) {
          console.log(`   ⚠️  Error adding document ${testFile.name}: ${error.message}`);
        }
      }
    }

    if (documentsAdded > 0) {
      console.log(`   ✅ Added ${documentsAdded} documents to applications\n`);
    } else {
      console.log(`   ⚠️  No documents were added (check file paths and permissions)\n`);
    }

    // Verify assignments were created
    console.log('📝 Step 6: Verifying reviewer assignments...');
    let totalAssignments = 0;
    const allAssignments = [];
    for (const appId of applicationIds) {
      const { data: assignments, error } = await supabase
        .from('application_assignments')
        .select('id, reviewer_id, status, application_id')
        .eq('application_id', appId);
      
      if (!error && assignments && assignments.length > 0) {
        totalAssignments += assignments.length;
        allAssignments.push(...assignments);
      }
    }
    
    if (totalAssignments > 0) {
      console.log(`   ✅ Verified ${totalAssignments} reviewer assignments created across ${applicationIds.length} applications\n`);
    } else {
      console.log(`   ⚠️  Warning: No reviewer assignments found!`);
      console.log(`   💡 Possible reasons:`);
      console.log(`      - Opportunities may not have sector_id set (check opportunities table)`);
      console.log(`      - Reviewers may not be assigned to sectors (check reviewer_sectors table)`);
      console.log(`      - RPC function may have failed (check error messages above)\n`);
    }

    // Step 7: Seed review scores for some assignments
    console.log('📝 Step 7: Seeding review scores...');
    let reviewScoresCreated = 0;
    
    if (allAssignments.length > 0) {

      // Sample score sets for different scenarios (varied quality)
      const scoreSets = [
        { innovation: 9, feasibility: 8, impact: 9, team: 8, recommendation: 'approve', comment: 'Excellent proposal with strong potential and a capable team.' },
        { innovation: 8, feasibility: 7, impact: 8, team: 7, recommendation: 'approve', comment: 'Strong proposal with clear market potential and solid execution plan.' },
        { innovation: 7, feasibility: 6, impact: 7, team: 7, recommendation: 'approve', comment: 'Good proposal, some areas need improvement but overall promising.' },
        { innovation: 6, feasibility: 6, impact: 6, team: 6, recommendation: 'request_info', comment: 'Needs more information about implementation timeline and resource requirements.' },
        { innovation: 5, feasibility: 5, impact: 5, team: 5, recommendation: 'request_info', comment: 'Requires clarification on market validation and scalability plans.' },
        { innovation: 4, feasibility: 3, impact: 4, team: 4, recommendation: 'reject', comment: 'Does not meet minimum requirements. Proposal lacks clarity and feasibility.' },
        { innovation: 3, feasibility: 2, impact: 3, team: 3, recommendation: 'reject', comment: 'Insufficient detail and weak business case. Not ready for funding.' },
      ];

      // Seed scores for approximately 40% of assignments (to have a mix of reviewed and pending)
      const assignmentsToScore = Math.floor(allAssignments.length * 0.4);
      const shuffledAssignments = [...allAssignments].sort(() => Math.random() - 0.5);
      const selectedAssignments = shuffledAssignments.slice(0, assignmentsToScore);

      for (const assignment of selectedAssignments) {
        // Skip if score already exists
        const { data: existing } = await supabase
          .from('review_scores')
          .select('id')
          .eq('application_id', assignment.application_id)
          .eq('reviewer_id', assignment.reviewer_id)
          .maybeSingle();

        if (existing) {
          continue;
        }

        // Pick a random score set (weighted towards approve/request_info for more realistic distribution)
        const rand = Math.random();
        let scoreSet;
        if (rand < 0.5) {
          // 50% chance of approve
          scoreSet = scoreSets[Math.floor(Math.random() * 3)]; // First 3 are approve
        } else if (rand < 0.8) {
          // 30% chance of request_info
          scoreSet = scoreSets[3 + Math.floor(Math.random() * 2)]; // Next 2 are request_info
        } else {
          // 20% chance of reject
          scoreSet = scoreSets[5 + Math.floor(Math.random() * 2)]; // Last 2 are reject
        }

        // Get application to find project sector (for proper scoring)
        const { data: application } = await supabase
          .from('applications')
          .select(`
            id,
            opportunity_id,
            opportunities!inner(
              id,
              sector_id
            )
          `)
          .eq('id', assignment.application_id)
          .maybeSingle();

        if (!application) {
          continue;
        }

        // Insert review score
        const { error: scoreError } = await supabase
          .from('review_scores')
          .insert({
            application_id: assignment.application_id,
            reviewer_id: assignment.reviewer_id,
            assignment_id: assignment.id,
            scores: {
              innovation: scoreSet.innovation,
              feasibility: scoreSet.feasibility,
              impact: scoreSet.impact,
              team: scoreSet.team,
            },
            comments: scoreSet.comment,
            recommendation: scoreSet.recommendation,
            submitted_at: new Date().toISOString(),
          });

        if (scoreError) {
          console.log(`   ⚠️  Failed to create review score for assignment ${assignment.id}: ${scoreError.message}`);
          continue;
        }

        // Update assignment status to completed
        await supabase
          .from('application_assignments')
          .update({ status: 'completed' })
          .eq('id', assignment.id);

        reviewScoresCreated++;
      }

      if (reviewScoresCreated > 0) {
        console.log(`   ✅ Created ${reviewScoresCreated} review scores (${selectedAssignments.length} assignments reviewed)\n`);
      } else {
        console.log(`   ℹ️  No review scores created (assignments may already have scores)\n`);
      }
    } else {
      console.log(`   ⚠️  No assignments found to seed scores for\n`);
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Seed data creation complete!\n');
    console.log('📊 Summary:');
    console.log(`   • 1 Admin user (admin@maali.test)`);
    console.log(`   • 1 Partner user (partner@maali.test) linked to Maali Test Partner Org`);
    console.log(`   • ${reviewers.length} Reviewer users`);
    console.log(`   • ${applicants.length} Applicant users`);
    console.log(`   • ${applicationIds.length} Applications created (distributed across Technology, Agriculture, FinTech)`);
    console.log(`   • ${documentsAdded} Documents added to applications`);
    console.log(`   • ${totalAssignments} Reviewer assignments created`);
    console.log(`   • ${reviewScoresCreated} Review scores created (simulating completed reviews)\n`);
    console.log('🔐 Login Credentials (all passwords: TestPassword123!):');
    console.log('   Admin: admin@maali.test');
    console.log('   Partner: partner@maali.test');
    console.log('   Reviewers: reviewer.tech@maali.test, reviewer.agriculture@maali.test, etc.');
    console.log('   Applicants: applicant1@maali.test, applicant2@maali.test, etc.\n');
    console.log('💡 Next Steps:');
    console.log('   1. Log in as admin to view the dashboard');
    console.log('   2. Check the Applications page to see reviewer assignments and scores');
    console.log('   3. Log in as a reviewer to see their assigned applications');
    console.log('   4. Some applications already have review scores for testing aggregation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error creating seed data:', error);
    process.exit(1);
  }
}

main();

