#!/usr/bin/env node
/**
 * Seed script for categories and projects
 * Uses Supabase JS client (same method as seed-users-and-reviewers.js)
 * 
 * Usage:
 *   node scripts/seed.js
 *   node scripts/seed.js --local
 *   node scripts/seed.js --help
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env
 *   - Or pass them as environment variables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { lookup } from 'node:dns/promises';

dotenv.config();
const args = new Set(process.argv.slice(2));
const useLocal = args.has('--local');

if (args.has('--help') || args.has('-h')) {
  console.log('Usage:');
  console.log('  node scripts/seed.js');
  console.log('  node scripts/seed.js --local');
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

// Seed categories
async function seedCategories() {
  console.log('📦 Seeding categories...');
  
  const categories = [
    { name: 'Technology', slug: 'technology', description: 'Technology and innovation projects', is_active: true },
    { name: 'FinTech', slug: 'fintech', description: 'Financial technology and payment solutions', is_active: true },
    { name: 'Agriculture', slug: 'agriculture', description: 'Agricultural innovation and food security projects', is_active: true },
  ];

  let insertedCount = 0;
  let skippedCount = 0;

  for (const category of categories) {
    // Check if category already exists
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category.name)
      .single();

    if (existing) {
      skippedCount++;
      continue;
    }

    const { error } = await supabase
      .from('categories')
      .insert(category);

    if (error) {
      console.error(`   ❌ Failed to seed category "${category.name}":`, error.message);
      throw error;
    } else {
      insertedCount++;
    }
  }

  if (insertedCount > 0) {
    console.log(`   ✅ ${insertedCount} categories inserted successfully`);
  }
  if (skippedCount > 0) {
    console.log(`   ℹ️  ${skippedCount} categories already exist (skipped)`);
  }
}

// Seed projects
async function seedProjects() {
  console.log('📦 Seeding projects...');

  // Get category IDs
  const technologyId = await getCategoryId('Technology');
  const fintechId = await getCategoryId('FinTech');
  const agricultureId = await getCategoryId('Agriculture');

  const projects = [
    {
      title: 'African Women Tech Entrepreneurs Grant',
      description: 'Supporting women-led tech startups across Africa with funding and mentorship. This grant aims to bridge the gender gap in technology entrepreneurship by providing financial support, business mentorship, and access to networks for women building innovative tech solutions.',
      category: 'Technology',
      category_id: technologyId,
      status: 'closed',
      deadline: '2025-12-15',
      funding_amount: '$50,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
      requirements: 'Business plan, pitch deck, financial projections, team bios, proof of concept or MVP',
      eligibility_criteria: 'Women-led tech startups, registered business, operating in Africa, minimum 6 months in operation, innovative tech solution',
      application_fee: 0.00,
      max_applicants: 50,
      current_applicants: 234,
      featured: false,
    },
    {
      title: 'FinTech for Financial Inclusion',
      description: 'Supporting fintech solutions that promote financial inclusion across Africa. This opportunity focuses on innovative payment systems, mobile banking, microfinance platforms, and other technologies that bring financial services to underserved communities.',
      category: 'FinTech',
      category_id: fintechId,
      status: 'open',
      deadline: '2025-10-20',
      funding_amount: '$75,000',
      location: 'West Africa',
      image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      requirements: 'Technical documentation, regulatory compliance proof, user acquisition metrics, scalability plan',
      eligibility_criteria: 'FinTech startup, focus on financial inclusion, operating in West Africa, regulatory compliance, demonstrable impact',
      application_fee: 25.00,
      max_applicants: 30,
      current_applicants: 89,
      featured: true,
    },
    {
      title: 'AI and Machine Learning Innovation Fund',
      description: 'Funding for African startups developing AI and ML solutions for local challenges. This includes healthcare AI, agricultural tech, education platforms, and other applications that leverage artificial intelligence to solve African problems.',
      category: 'Technology',
      category_id: technologyId,
      status: 'open',
      deadline: '2027-11-30',
      funding_amount: '$100,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800',
      requirements: 'Technical architecture, AI/ML model documentation, data privacy compliance, use case validation',
      eligibility_criteria: 'AI/ML focused startup, clear technical roadmap, data-driven solution, ethical AI practices, African market focus',
      application_fee: 0.00,
      max_applicants: 20,
      current_applicants: 45,
      featured: true,
    },
    {
      title: 'E-commerce Platform Development Grant',
      description: 'Supporting the development of e-commerce platforms that connect African businesses with local and international markets. Focus on platforms that enable small and medium enterprises to sell online.',
      category: 'Technology',
      category_id: technologyId,
      status: 'open',
      deadline: '2028-01-15',
      funding_amount: '$40,000',
      location: 'East Africa',
      image_url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
      requirements: 'Platform demo, business model, market analysis, user acquisition strategy',
      eligibility_criteria: 'E-commerce platform, focus on SMEs, operating in East Africa, early-stage to growth stage',
      application_fee: 0.00,
      max_applicants: 40,
      current_applicants: 0,
      featured: false,
    },
    {
      title: 'Sustainable Agriculture Innovation Fund',
      description: 'Funding innovative agricultural solutions for food security in rural communities. This includes smart farming technologies, irrigation systems, crop management apps, and sustainable farming practices.',
      category: 'Agriculture',
      category_id: agricultureId,
      status: 'open',
      deadline: '2027-11-30',
      funding_amount: '$25,000',
      location: 'East Africa',
      image_url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
      requirements: 'Project proposal, impact assessment, sustainability plan, community engagement strategy',
      eligibility_criteria: 'Agriculture-focused solution, rural community focus, sustainable practices, demonstrable impact on food security',
      application_fee: 0.00,
      max_applicants: 60,
      current_applicants: 156,
      featured: false,
    },
    {
      title: 'Smart Irrigation System for Smallholder Farmers',
      description: 'Develop affordable IoT-based irrigation solutions to help smallholder farmers optimize water usage and increase crop yields in sub-Saharan Africa.',
      category: 'Agriculture',
      category_id: agricultureId,
      status: 'open',
      deadline: '2027-12-20',
      funding_amount: '$60,000',
      location: 'Sub-Saharan Africa',
      image_url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800',
      requirements: 'Technical specifications, prototype or MVP, cost analysis, deployment plan',
      eligibility_criteria: 'IoT/tech solution for agriculture, focus on smallholder farmers, water efficiency, scalable technology',
      application_fee: 15.00,
      max_applicants: 25,
      current_applicants: 78,
      featured: true,
    },
    {
      title: 'AgriTech Supply Chain Innovation',
      description: 'Supporting technology solutions that improve agricultural supply chains, reduce post-harvest losses, and connect farmers directly with markets.',
      category: 'Agriculture',
      category_id: agricultureId,
      status: 'open',
      deadline: '2027-10-10',
      funding_amount: '$35,000',
      location: 'West Africa',
      image_url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
      requirements: 'Supply chain analysis, technology solution, market connections, impact metrics',
      eligibility_criteria: 'Supply chain solution, focus on reducing losses, market connectivity, West African operations',
      application_fee: 20.00,
      max_applicants: 35,
      current_applicants: 92,
      featured: false,
    },
    {
      title: 'Mobile Money Solutions Grant',
      description: 'Funding for innovative mobile money and payment solutions that increase financial access in underserved African communities.',
      category: 'FinTech',
      category_id: fintechId,
      status: 'open',
      deadline: '2027-12-05',
      funding_amount: '$55,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
      requirements: 'Technical documentation, security audit, regulatory compliance, user testing results',
      eligibility_criteria: 'Mobile payment solution, financial inclusion focus, security compliance, regulatory approval',
      application_fee: 0.00,
      max_applicants: 45,
      current_applicants: 123,
      featured: false,
    },
    {
      title: 'Cryptocurrency and Blockchain for Development',
      description: 'Supporting blockchain and cryptocurrency solutions that address real-world development challenges in Africa, such as remittances, identity verification, and transparent governance.',
      category: 'FinTech',
      category_id: fintechId,
      status: 'open',
      deadline: '2028-02-28',
      funding_amount: '$80,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
      requirements: 'Blockchain architecture, whitepaper, use case validation, technical roadmap',
      eligibility_criteria: 'Blockchain/crypto solution, development focus, clear use case, technical feasibility',
      application_fee: 0.00,
      max_applicants: 15,
      current_applicants: 0,
      featured: true,
    },
    {
      title: 'EdTech Innovation for Rural Education',
      description: 'Supporting educational technology platforms that improve access to quality education in rural and underserved African communities.',
      category: 'Technology',
      category_id: technologyId,
      status: 'open',
      deadline: '2027-11-25',
      funding_amount: '$45,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1503676260728-1c6019ae5030?w=800',
      requirements: 'Educational content, platform demo, impact assessment, scalability plan',
      eligibility_criteria: 'EdTech platform, rural focus, quality education access, scalable solution',
      application_fee: 0.00,
      max_applicants: 50,
      current_applicants: 167,
      featured: false,
    },
    {
      title: 'Healthcare Technology Innovation',
      description: 'Funding for health tech solutions that improve healthcare delivery, telemedicine, health records management, and access to medical services in Africa.',
      category: 'Technology',
      category_id: technologyId,
      status: 'open',
      deadline: '2027-12-10',
      funding_amount: '$65,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800',
      requirements: 'Medical compliance documentation, platform demo, healthcare professional validation, privacy compliance',
      eligibility_criteria: 'Health tech solution, healthcare improvement focus, regulatory compliance, medical professional support',
      application_fee: 30.00,
      max_applicants: 30,
      current_applicants: 98,
      featured: false,
    },
    {
      title: 'Green Energy Technology Fund',
      description: 'Supporting renewable energy solutions including solar, wind, and hydro technologies that provide clean energy access to African communities.',
      category: 'Technology',
      category_id: technologyId,
      status: 'open',
      deadline: '2027-10-15',
      funding_amount: '$90,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
      requirements: 'Technical specifications, environmental impact assessment, cost-benefit analysis, deployment strategy',
      eligibility_criteria: 'Renewable energy solution, clean energy focus, African community access, technical feasibility',
      application_fee: 0.00,
      max_applicants: 20,
      current_applicants: 67,
      featured: true,
    },
    {
      title: 'Transportation and Logistics Tech',
      description: 'Funding for technology solutions that improve transportation, logistics, and mobility in African cities and rural areas.',
      category: 'Technology',
      category_id: technologyId,
      status: 'open',
      deadline: '2028-01-30',
      funding_amount: '$50,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      requirements: 'Business model, technology solution, market analysis, scalability plan',
      eligibility_criteria: 'Transport/logistics solution, African market focus, innovative approach, scalable technology',
      application_fee: 0.00,
      max_applicants: 40,
      current_applicants: 0,
      featured: false,
    },
  ];

  // Insert projects (check for existing ones first to avoid duplicates)
  let insertedCount = 0;
  let skippedCount = 0;

  for (const project of projects) {
    // Check if project with same title already exists
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('title', project.title)
      .single();

    if (existing) {
      skippedCount++;
      continue;
    }

    const { error } = await supabase
      .from('projects')
      .insert(project);

    if (error) {
      console.error(`   ⚠️  Failed to insert project "${project.title}":`, error.message);
      // Continue with other projects instead of failing completely
    } else {
      insertedCount++;
    }
  }

  if (insertedCount > 0) {
    console.log(`   ✅ ${insertedCount} projects inserted successfully`);
  }
  if (skippedCount > 0) {
    console.log(`   ℹ️  ${skippedCount} projects already exist (skipped)`);
  }
}

async function main() {
  try {
    console.log('🌱 Starting seed process...\n');
    
    await verifySupabaseHost();
    
    // Seed categories first
    await seedCategories();
    
    // Then seed projects
    await seedProjects();
    
    console.log('\n✅ Seed data inserted successfully!');
  } catch (error) {
    console.error('\n❌ Error executing seed script:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    process.exit(1);
  }
}

main();
