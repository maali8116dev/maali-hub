/**
 * Seed script for users, applicants, reviewers, and reviewer assignments
 * 
 * This script creates:
 * - 1 Admin user
 * - 5 Reviewer users (assigned to different categories)
 * - 10 Applicant users
 * - 20 Applications from applicants (distributed across categories)
 * - Reviewer assignments using the actual RPC function (to test assignment logic)
 * 
 * Usage:
 *   node scripts/seed-users-and-reviewers.js
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env
 *   - Or pass them as environment variables
 *   - Projects must be seeded first (run: npm run supabase:seed)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  console.error('\nPlease set these in your .env file:');
  console.error('   VITE_SUPABASE_URL=your_supabase_url');
  console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('\nOr use:');
  console.error('   SUPABASE_URL=your_supabase_url');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper to delete user if exists (for idempotent seed runs)
async function deleteUserIfExists(email) {
  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);
    
    if (user) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.log(`   ⚠️  Failed to delete existing user ${email}: ${deleteError.message}`);
      } else {
        console.log(`   🗑️  Deleted existing user: ${email}`);
      }
    }
  } catch (error) {
    // Ignore errors - user might not exist
    console.log(`   ℹ️  User ${email} does not exist, skipping delete`);
  }
}

// Helper to create a user with profile
async function createUserWithProfile(userData) {
  const { email, password, firstName, lastName, role, businessName, country, bio } = userData;
  
  // Delete user if exists (for idempotent runs)
  await deleteUserIfExists(email);
  
  // Create auth user
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
    console.error(`   ❌ User ${email} creation failed:`, authError.message);
    throw authError;
  }

  const userId = authData.user.id;

  // Create/update profile
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
    console.error(`   ❌ Failed to create profile for ${email}:`, profileError.message);
    throw profileError;
  }

  return userId;
}

// Helper to get category ID by name
async function getCategoryId(categoryName) {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName)
    .single();

  if (error || !data) {
    throw new Error(`Category "${categoryName}" not found. Make sure categories are seeded first.`);
  }

  return data.id;
}

// Helper to assign reviewer to category
async function assignReviewerToCategory(reviewerId, categoryName) {
  const categoryId = await getCategoryId(categoryName);
  
  const { error } = await supabase
    .from('reviewer_categories')
    .upsert({
      reviewer_id: reviewerId,
      category_id: categoryId,
    }, {
      onConflict: 'reviewer_id,category_id',
    });

  if (error) {
    console.error(`   ⚠️  Failed to assign reviewer to ${categoryName}:`, error.message);
  }
}

// Helper to create application
async function createApplication(applicationData) {
  const { userId, projectId, companyName, contactEmail, contactPhone, location, projectDescription, fundingAmount } = applicationData;

  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      project_id: projectId,
      company_name: companyName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      location: location,
      project_description: projectDescription,
      funding_amount_requested: fundingAmount,
      status: 'pending',
      is_draft: false,
    })
    .select()
    .single();

  if (error) {
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

// Get open projects
async function getOpenProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, category_id, category, categories(name)')
    .eq('status', 'open')
    .limit(20); // Get more projects to ensure we have enough with category_id

  if (error) {
    throw error;
  }

  // Filter to only projects with category_id (required for reviewer assignment)
  const projectsWithCategory = (data || []).filter(p => p.category_id !== null);
  
  if (projectsWithCategory.length === 0) {
    console.log('   ⚠️  Warning: No projects found with category_id set.');
    console.log('   💡 Tip: Run the migration that populates category_id from the category field.');
  }

  return projectsWithCategory.length > 0 ? projectsWithCategory : (data || []);
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
      'reviewer.tech@maali.test',
      'reviewer.agriculture@maali.test',
      'reviewer.fintech@maali.test',
      'reviewer.multi@maali.test',
      'reviewer.tech2@maali.test',
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
  } catch (error) {
    console.log(`   ⚠️  Cleanup error (continuing anyway): ${error.message}\n`);
  }
}

async function main() {
  console.log('🌱 Starting seed data creation...\n');

  try {
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

    // Step 2: Create Reviewers
    console.log('📝 Step 2: Creating reviewer users...');
    const reviewers = [
      {
        email: 'reviewer.tech@maali.test',
        firstName: 'Sarah',
        lastName: 'Tech',
        role: 'reviewer',
        categories: ['Technology'],
        country: 'Ghana',
        bio: 'Technology expert with 10+ years in software development',
      },
      {
        email: 'reviewer.agriculture@maali.test',
        firstName: 'Kwame',
        lastName: 'Agri',
        role: 'reviewer',
        categories: ['Agriculture'],
        country: 'Ghana',
        bio: 'Agricultural specialist focusing on sustainable farming',
      },
      {
        email: 'reviewer.fintech@maali.test',
        firstName: 'Ama',
        lastName: 'Finance',
        role: 'reviewer',
        categories: ['FinTech'],
        country: 'Nigeria',
        bio: 'FinTech consultant with expertise in financial inclusion',
      },
      {
        email: 'reviewer.multi@maali.test',
        firstName: 'David',
        lastName: 'Multi',
        role: 'reviewer',
        categories: ['Technology', 'Agriculture'], // Multi-category reviewer
        country: 'Kenya',
        bio: 'Experienced reviewer across multiple categories',
      },
      {
        email: 'reviewer.tech2@maali.test',
        firstName: 'Grace',
        lastName: 'Innovation',
        role: 'reviewer',
        categories: ['Technology'],
        country: 'South Africa',
        bio: 'Tech innovation specialist',
      },
    ];

    const reviewerIds = [];
    for (const reviewer of reviewers) {
      const { categories, ...userData } = reviewer;
      const reviewerId = await createUserWithProfile(userData);
      reviewerIds.push(reviewerId);
      
      // Assign reviewer to categories
      for (const category of categories) {
        await assignReviewerToCategory(reviewerId, category);
      }
      
      console.log(`   ✅ Created reviewer: ${reviewer.email} (${reviewerId.substring(0, 8)}...) - Categories: ${categories.join(', ')}`);
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

    // Step 4: Get open projects and ensure they have category_id
    console.log('📝 Step 4: Fetching open projects...');
    let projects = await getOpenProjects();
    if (projects.length === 0) {
      console.log('   ⚠️  No open projects found. Please seed projects first using supabase/seed.sql');
      return;
    }
    
    // Ensure projects have category_id set (required for reviewer assignment)
    console.log('   🔧 Ensuring projects have category_id set...');
    let fixedCount = 0;
    for (const project of projects) {
      if (!project.category_id && project.category) {
        // Try to find category by name
        const categoryId = await getCategoryId(project.category).catch(() => null);
        if (categoryId) {
          const { error } = await supabase
            .from('projects')
            .update({ category_id: categoryId })
            .eq('id', project.id);
          
          if (!error) {
            project.category_id = categoryId;
            fixedCount++;
          }
        }
      }
    }
    
    if (fixedCount > 0) {
      console.log(`   ✅ Fixed ${fixedCount} projects to have category_id\n`);
    }
    
    // Filter to only projects with category_id
    projects = projects.filter(p => p.category_id !== null);
    
    if (projects.length === 0) {
      console.log('   ⚠️  No projects with category_id found. Cannot create applications with reviewer assignments.');
      console.log('   💡 Please ensure projects have category_id set in the database.');
      return;
    }
    
    console.log(`   ✅ Found ${projects.length} open projects with category_id\n`);

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

    // Map projects to categories for better assignment
    const projectCategoryMap = new Map();
    projects.forEach(project => {
      const categoryName = project.categories?.name || 'Technology';
      if (!projectCategoryMap.has(categoryName)) {
        projectCategoryMap.set(categoryName, []);
      }
      projectCategoryMap.get(categoryName).push(project);
    });

    // Create 20 applications - distribute across applicants and projects
    const applicationIds = [];
    let applicantIndex = 0;
    let templateIndex = 0;

    // Create 20 applications to thoroughly test the assignment system
    for (let i = 0; i < 20; i++) {
      // Cycle through applicants
      const currentApplicant = applicants[applicantIndex % applicants.length];
      applicantIndex++;

      // Select project based on category distribution
      // Technology: 40%, Agriculture: 30%, FinTech: 30%
      let categoryName;
      const rand = Math.random();
      if (rand < 0.4) {
        categoryName = 'Technology';
      } else if (rand < 0.7) {
        categoryName = 'Agriculture';
      } else {
        categoryName = 'FinTech';
      }

      // Get a project from the selected category
      const categoryProjects = projectCategoryMap.get(categoryName) || projectCategoryMap.get('Technology') || projects;
      const project = categoryProjects[i % categoryProjects.length];
      
      if (!project) continue;

      // Use template content but customize for current applicant
      const template = applicationTemplates[templateIndex % applicationTemplates.length];
      templateIndex++;

      const applicationId = await createApplication({
        userId: currentApplicant.userId,
        projectId: project.id,
        companyName: template.companyName,
        contactEmail: currentApplicant.email,
        contactPhone: template.contactPhone,
        location: template.location,
        projectDescription: template.projectDescription,
        fundingAmount: template.fundingAmount,
      });
      
      applicationIds.push(applicationId);
      console.log(`   ✅ Created application ${i + 1}/20: ${template.companyName} by ${currentApplicant.email} for "${project.title}" (${categoryName})`);

      // Use the RPC function to auto-assign reviewers (this tests the actual assignment logic)
      try {
        // Verify project has category_id before attempting assignment
        if (!project.category_id) {
          console.log(`   ⚠️  Skipping assignment: Project "${project.title}" has no category_id (only has category: ${project.categories?.name || 'unknown'})`);
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
          console.log(`   ⚠️  No reviewers assigned (RPC returned empty array - may need more reviewers for ${categoryName})`);
        }
      } catch (error) {
        console.log(`   ⚠️  Assignment error: ${error.message}`);
        console.log(`       Full error: ${JSON.stringify(error, null, 2)}`);
      }
    }

    console.log(`\n   ✅ Created ${applicationIds.length} applications\n`);

    // Verify assignments were created
    console.log('📝 Step 6: Verifying reviewer assignments...');
    let totalAssignments = 0;
    for (const appId of applicationIds) {
      const { data: assignments, error } = await supabase
        .from('application_assignments')
        .select('id, reviewer_id, status')
        .eq('application_id', appId);
      
      if (!error && assignments && assignments.length > 0) {
        totalAssignments += assignments.length;
      }
    }
    
    if (totalAssignments > 0) {
      console.log(`   ✅ Verified ${totalAssignments} reviewer assignments created across ${applicationIds.length} applications\n`);
    } else {
      console.log(`   ⚠️  Warning: No reviewer assignments found!`);
      console.log(`   💡 Possible reasons:`);
      console.log(`      - Projects may not have category_id set (check projects table)`);
      console.log(`      - Reviewers may not be assigned to categories (check reviewer_categories table)`);
      console.log(`      - RPC function may have failed (check error messages above)\n`);
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Seed data creation complete!\n');
    console.log('📊 Summary:');
    console.log(`   • 1 Admin user (admin@maali.test)`);
    console.log(`   • ${reviewers.length} Reviewer users`);
    console.log(`   • ${applicants.length} Applicant users`);
    console.log(`   • ${applicationIds.length} Applications created (distributed across Technology, Agriculture, FinTech)`);
    console.log(`   • ${totalAssignments} Reviewer assignments created\n`);
    console.log('🔐 Login Credentials (all passwords: TestPassword123!):');
    console.log('   Admin: admin@maali.test');
    console.log('   Reviewers: reviewer.tech@maali.test, reviewer.agriculture@maali.test, etc.');
    console.log('   Applicants: applicant1@maali.test, applicant2@maali.test, etc.\n');
    console.log('💡 Next Steps:');
    console.log('   1. Log in as admin to view the dashboard');
    console.log('   2. Check the Applications page to see reviewer assignments');
    console.log('   3. Log in as a reviewer to see their assigned applications');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error creating seed data:', error);
    process.exit(1);
  }
}

main();

