#!/usr/bin/env node
/**
 * Seed script for sectors and projects
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

// Seed sectors
async function seedSectors() {
  console.log('📦 Seeding sectors...');
  
  const sectors = [
    { name: 'Technology', slug: 'technology', description: 'Technology and innovation projects', is_active: true },
    { name: 'FinTech', slug: 'fintech', description: 'Financial technology and payment solutions', is_active: true },
    { name: 'Agriculture', slug: 'agriculture', description: 'Agricultural innovation and food security projects', is_active: true },
  ];

  let insertedCount = 0;
  let skippedCount = 0;

  for (const sector of sectors) {
    // Check if sector already exists
    const { data: existing } = await supabase
      .from('sectors')
      .select('id')
      .eq('name', sector.name)
      .single();

    if (existing) {
      skippedCount++;
      continue;
    }

    const { error } = await supabase
      .from('sectors')
      .insert(sector);

    if (error) {
      console.error(`   ❌ Failed to seed sector "${sector.name}":`, error.message);
      throw error;
    } else {
      insertedCount++;
    }
  }

  if (insertedCount > 0) {
    console.log(`   ✅ ${insertedCount} sectors inserted successfully`);
  }
  if (skippedCount > 0) {
    console.log(`   ℹ️  ${skippedCount} sectors already exist (skipped)`);
  }
}

// Seed opportunities (using projects seed data, into opportunities table)
async function seedProjects() {
  console.log('📦 Seeding opportunities...');

  // Get sector IDs
  const technologyId = await getSectorId('Technology');
  const fintechId = await getSectorId('FinTech');
  const agricultureId = await getSectorId('Agriculture');

  const projects = [
    {
      title: 'African Women Tech Entrepreneurs Grant',
      description: 'Supporting women-led tech startups across Africa with funding and mentorship. This grant aims to bridge the gender gap in technology entrepreneurship by providing financial support, business mentorship, and access to networks for women building innovative tech solutions.',
      sector: 'Technology',
      sector_id: technologyId,
      status: 'closed',
      deadline: '2025-12-15',
      funding_amount: '$50,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
      requirements: 'Business plan\nPitch deck\nFinancial projections\nTeam bios\nProof of concept or MVP',
      eligibility_criteria: 'Women-led tech startups\nRegistered business\nOperating in Africa\nMinimum 6 months in operation\nInnovative tech solution',
      application_fee: 0.00,
      max_applicants: 50,
      current_applicants: 234,
      featured: false,
    },
    {
      title: 'FinTech for Financial Inclusion',
      description: 'Supporting fintech solutions that promote financial inclusion across Africa. This opportunity focuses on innovative payment systems, mobile banking, microfinance platforms, and other technologies that bring financial services to underserved communities.',
      sector: 'FinTech',
      sector_id: fintechId,
      status: 'open',
      deadline: '2025-10-20',
      funding_amount: '$75,000',
      location: 'West Africa',
      image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      requirements: 'Technical documentation\nRegulatory compliance proof\nUser acquisition metrics\nScalability plan',
      eligibility_criteria: 'FinTech startup\nFocus on financial inclusion\nOperating in West Africa\nRegulatory compliance\nDemonstrable impact',
      application_fee: 25.00,
      max_applicants: 30,
      current_applicants: 89,
      featured: true,
    },
    {
      title: 'AI and Machine Learning Innovation Fund',
      description: 'Funding for African startups developing AI and ML solutions for local challenges. This includes healthcare AI, agricultural tech, education platforms, and other applications that leverage artificial intelligence to solve African problems.',
      sector: 'Technology',
      sector_id: technologyId,
      status: 'open',
      deadline: '2027-11-30',
      funding_amount: '$100,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800',
      requirements: 'Technical architecture\nAI/ML model documentation\nData privacy compliance\nUse case validation',
      eligibility_criteria: 'AI/ML focused startup\nClear technical roadmap\nData-driven solution\nEthical AI practices\nAfrican market focus',
      application_fee: 20.00,
      max_applicants: 20,
      current_applicants: 45,
      featured: true,
    },
    {
      title: 'E-commerce Platform Development Grant',
      description: 'Supporting the development of e-commerce platforms that connect African businesses with local and international markets. Focus on platforms that enable small and medium enterprises to sell online.',
      sector: 'Technology',
      sector_id: technologyId,
      status: 'open',
      deadline: '2028-01-15',
      funding_amount: '$40,000',
      location: 'East Africa',
      image_url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
      requirements: 'Platform demo\nBusiness model\nMarket analysis\nUser acquisition strategy',
      eligibility_criteria: 'E-commerce platform\nFocus on SMEs\nOperating in East Africa\nEarly-stage to growth stage',
      application_fee: 10.00,
      max_applicants: 40,
      current_applicants: 0,
      featured: false,
    },
    {
      title: 'Sustainable Agriculture Innovation Fund',
      description: 'Funding innovative agricultural solutions for food security in rural communities. This includes smart farming technologies, irrigation systems, crop management apps, and sustainable farming practices.',
      sector: 'Agriculture',
      sector_id: agricultureId,
      status: 'open',
      deadline: '2027-11-30',
      funding_amount: '$25,000',
      location: 'East Africa',
      image_url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
      requirements: 'Project proposal\nImpact assessment\nSustainability plan\nCommunity engagement strategy',
      eligibility_criteria: 'Agriculture-focused solution\nRural community focus\nSustainable practices\nDemonstrable impact on food security',
      application_fee: 10.00,
      max_applicants: 60,
      current_applicants: 156,
      featured: false,
    },
    {
      title: 'Smart Irrigation System for Smallholder Farmers',
      description: 'Develop affordable IoT-based irrigation solutions to help smallholder farmers optimize water usage and increase crop yields in sub-Saharan Africa.',
      sector: 'Agriculture',
      sector_id: agricultureId,
      status: 'open',
      deadline: '2027-12-20',
      funding_amount: '$60,000',
      location: 'Sub-Saharan Africa',
      image_url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800',
      requirements: 'Technical specifications\nPrototype or MVP\nCost analysis\nDeployment plan',
      eligibility_criteria: 'IoT/tech solution for agriculture\nFocus on smallholder farmers\nWater efficiency\nScalable technology',
      application_fee: 15.00,
      max_applicants: 25,
      current_applicants: 78,
      featured: true,
    },
    {
      title: 'AgriTech Supply Chain Innovation',
      description: 'Supporting technology solutions that improve agricultural supply chains, reduce post-harvest losses, and connect farmers directly with markets.',
      sector: 'Agriculture',
      sector_id: agricultureId,
      status: 'open',
      deadline: '2027-10-10',
      funding_amount: '$35,000',
      location: 'West Africa',
      image_url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
      requirements: 'Supply chain analysis\nTechnology solution\nMarket connections\nImpact metrics',
      eligibility_criteria: 'Supply chain solution\nFocus on reducing losses\nMarket connectivity\nWest African operations',
      application_fee: 20.00,
      max_applicants: 35,
      current_applicants: 92,
      featured: false,
    },
    {
      title: 'Mobile Money Solutions Grant',
      description: 'Funding for innovative mobile money and payment solutions that increase financial access in underserved African communities.',
      sector: 'FinTech',
      sector_id: fintechId,
      status: 'open',
      deadline: '2027-12-05',
      funding_amount: '$55,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
      requirements: 'Technical documentation\nSecurity audit\nRegulatory compliance\nUser testing results',
      eligibility_criteria: 'Mobile payment solution\nFinancial inclusion focus\nSecurity compliance\nRegulatory approval',
      application_fee: 15.00,
      max_applicants: 45,
      current_applicants: 123,
      featured: false,
    },
    {
      title: 'Cryptocurrency and Blockchain for Development',
      description: 'Supporting blockchain and cryptocurrency solutions that address real-world development challenges in Africa, such as remittances, identity verification, and transparent governance.',
      sector: 'FinTech',
      sector_id: fintechId,
      status: 'open',
      deadline: '2028-02-28',
      funding_amount: '$80,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
      requirements: 'Blockchain architecture\nWhitepaper\nUse case validation\nTechnical roadmap',
      eligibility_criteria: 'Blockchain/crypto solution\nDevelopment focus\nClear use case\nTechnical feasibility',
      application_fee: 25.00,
      max_applicants: 15,
      current_applicants: 0,
      featured: true,
    },
    {
      title: 'EdTech Innovation for Rural Education',
      description: 'Supporting educational technology platforms that improve access to quality education in rural and underserved African communities.',
      sector: 'Technology',
      sector_id: technologyId,
      status: 'open',
      deadline: '2027-11-25',
      funding_amount: '$45,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1503676260728-1c6019ae5030?w=800',
      requirements: 'Educational content\nPlatform demo\nImpact assessment\nScalability plan',
      eligibility_criteria: 'EdTech platform\nRural focus\nQuality education access\nScalable solution',
      application_fee: 5.00,
      max_applicants: 50,
      current_applicants: 167,
      featured: false,
    },
    {
      title: 'Healthcare Technology Innovation',
      description: 'Funding for health tech solutions that improve healthcare delivery, telemedicine, health records management, and access to medical services in Africa.',
      sector: 'Technology',
      sector_id: technologyId,
      status: 'open',
      deadline: '2027-12-10',
      funding_amount: '$65,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800',
      requirements: 'Medical compliance documentation\nPlatform demo\nHealthcare professional validation\nPrivacy compliance',
      eligibility_criteria: 'Health tech solution\nHealthcare improvement focus\nRegulatory compliance\nMedical professional support',
      application_fee: 30.00,
      max_applicants: 30,
      current_applicants: 98,
      featured: false,
    },
    {
      title: 'Green Energy Technology Fund',
      description: 'Supporting renewable energy solutions including solar, wind, and hydro technologies that provide clean energy access to African communities.',
      sector: 'Technology',
      sector_id: technologyId,
      status: 'open',
      deadline: '2027-10-15',
      funding_amount: '$90,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
      requirements: 'Technical specifications\nEnvironmental impact assessment\nCost-benefit analysis\nDeployment strategy',
      eligibility_criteria: 'Renewable energy solution\nClean energy focus\nAfrican community access\nTechnical feasibility',
      application_fee: 20.00,
      max_applicants: 20,
      current_applicants: 67,
      featured: true,
    },
    {
      title: 'Transportation and Logistics Tech',
      description: 'Funding for technology solutions that improve transportation, logistics, and mobility in African cities and rural areas.',
      sector: 'Technology',
      sector_id: technologyId,
      status: 'open',
      deadline: '2028-01-30',
      funding_amount: '$50,000',
      location: 'Pan-African',
      image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      requirements: 'Business model\nTechnology solution\nMarket analysis\nScalability plan',
      eligibility_criteria: 'Transport/logistics solution\nAfrican market focus\nInnovative approach\nScalable technology',
      application_fee: 10.00,
      max_applicants: 40,
      current_applicants: 0,
      featured: false,
    },
  ];

  // Insert opportunities (check for existing ones first to avoid duplicates)
  let insertedCount = 0;
  let skippedCount = 0;

  for (const project of projects) {
    // Check if opportunity with same title already exists
    const { data: existing } = await supabase
      .from('opportunities')
      .select('id')
      .eq('title', project.title)
      .single();

    if (existing) {
      skippedCount++;
      continue;
    }

    const { error } = await supabase
      .from('opportunities')
      .insert({
        title: project.title,
        description: project.description,
        sector_id: project.sector_id,
        status: project.status,
        deadline: project.deadline,
        funding_amount: project.funding_amount,
        location: project.location,
        image_url: project.image_url,
        requirements: project.requirements,
        eligibility_criteria: project.eligibility_criteria,
        application_fee: project.application_fee,
        max_applicants: project.max_applicants,
        current_applicants: project.current_applicants,
        featured: project.featured,
      });

    if (error) {
      console.error(`   ⚠️  Failed to insert opportunity "${project.title}":`, error.message);
      // Continue with other projects instead of failing completely
    } else {
      insertedCount++;
    }
  }

  if (insertedCount > 0) {
    console.log(`   ✅ ${insertedCount} opportunities inserted successfully`);
  }
  if (skippedCount > 0) {
    console.log(`   ℹ️  ${skippedCount} opportunities already exist (skipped)`);
  }
}

async function main() {
  try {
    console.log('🌱 Starting seed process...\n');
    
    await verifySupabaseHost();
    
    // Seed sectors first
    await seedSectors();
    
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
