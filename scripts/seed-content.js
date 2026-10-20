#!/usr/bin/env node
/**
 * Seed script for mentors, FAQs, success stories, and partners.
 *
 * Usage:
 *   node scripts/seed-content.js
 *   node scripts/seed-content.js --local
 *   node scripts/seed-content.js --help
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { lookup } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const args = new Set(process.argv.slice(2));
const useLocal = args.has('--local');

if (args.has('--help') || args.has('-h')) {
  console.log('Usage:');
  console.log('  node scripts/seed-content.js');
  console.log('  node scripts/seed-content.js --local');
  console.log('');
  console.log('Options:');
  console.log('  --local   Use local Supabase URL and service role key');
  console.log('  --help    Show this help message');
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
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(SUPABASE_URL);
} catch {
  console.error('Invalid SUPABASE_URL format:', SUPABASE_URL);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILES_DIR = path.join(__dirname, '..', 'src', 'test', 'files');

async function verifySupabaseHost() {
  if (useLocal) return;
  try {
    await lookup(parsedSupabaseUrl.hostname);
  } catch {
    console.error('Supabase host is not reachable:', parsedSupabaseUrl.hostname);
    process.exit(1);
  }
}

async function upsertByMatch({ table, match, payload }) {
  const query = supabase.from(table).select('id').limit(1);
  Object.entries(match).forEach(([key, value]) => {
    query.eq(key, value);
  });

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) throw findError;

  if (existing?.id) {
    const { error: updateError } = await supabase.from(table).update(payload).eq('id', existing.id);
    if (updateError) throw updateError;
    return 'updated';
  }

  const { error: insertError } = await supabase.from(table).insert(payload);
  if (insertError) throw insertError;
  return 'inserted';
}

async function seedMentors() {
  const mentors = [
    {
      name: 'Akosua Mensah',
      bio: 'Product and growth mentor focused on early-stage founders.',
      expertise_areas: ['Product Strategy', 'Go-to-Market', 'Fundraising'],
      sector: 'Technology',
      country: 'Ghana',
      linkedin_url: 'https://www.linkedin.com/in/akosua-mensah',
      is_published: true,
      display_order: 1,
    },
    {
      name: 'Kwame Boateng',
      bio: 'Agribusiness mentor helping startups scale across value chains.',
      expertise_areas: ['Agriculture', 'Operations', 'Supply Chain'],
      sector: 'Agriculture',
      country: 'Ghana',
      linkedin_url: 'https://www.linkedin.com/in/kwame-boateng',
      is_published: true,
      display_order: 2,
    },
    {
      name: 'Amara Okafor',
      bio: 'FinTech mentor with experience in payments and compliance.',
      expertise_areas: ['Payments', 'Compliance', 'Risk'],
      sector: 'FinTech',
      country: 'Nigeria',
      linkedin_url: 'https://www.linkedin.com/in/amara-okafor',
      is_published: true,
      display_order: 3,
    },
  ];

  let inserted = 0;
  let updated = 0;
  for (const mentor of mentors) {
    const action = await upsertByMatch({
      table: 'mentors',
      match: { name: mentor.name },
      payload: mentor,
    });
    if (action === 'inserted') inserted++;
    if (action === 'updated') updated++;
  }
  console.log(`Mentors: ${inserted} inserted, ${updated} updated`);
}

async function seedFaqs() {
  const faqs = [
    {
      question: 'How do I apply for an opportunity?',
      answer: 'Create an applicant account, open an opportunity, and submit the application form before the deadline.',
      Sector: 'General',
      display_order: 1,
      is_published: true,
    },
    {
      question: 'Can I save my application and finish later?',
      answer: 'Yes. Applications can be saved as draft and submitted when complete.',
      Sector: 'Applications',
      display_order: 2,
      is_published: true,
    },
    {
      question: 'How are applications reviewed?',
      answer: 'Applications are assigned to reviewers based on sector and evaluated with a standardized rubric.',
      Sector: 'Reviews',
      display_order: 3,
      is_published: true,
    },
  ];

  let inserted = 0;
  let updated = 0;
  for (const faq of faqs) {
    const action = await upsertByMatch({
      table: 'faqs',
      match: { question: faq.question },
      payload: faq,
    });
    if (action === 'inserted') inserted++;
    if (action === 'updated') updated++;
  }
  console.log(`FAQs: ${inserted} inserted, ${updated} updated`);
}

async function seedSuccessStories() {
  const successStories = [
    {
      name: 'Nana Asare',
      company: 'FarmSense Africa',
      sector: 'Agriculture',
      location: 'Kumasi, Ghana',
      funding_amount: '$40,000',
      funding_date: '2025-06-15',
      description: 'Scaled smart irrigation pilots to 120 smallholder farmers within 6 months.',
      impact_metrics: '120 farmers onboarded; 28% water-use reduction',
      featured: true,
      display_order: 1,
      status: 'published',
    },
    {
      name: 'Zainab Bello',
      company: 'PayBridge',
      sector: 'FinTech',
      location: 'Lagos, Nigeria',
      funding_amount: '$60,000',
      funding_date: '2025-08-01',
      description: 'Launched cross-border payment rails for SMEs trading across West Africa.',
      impact_metrics: '1,800 SME transactions in first quarter',
      featured: true,
      display_order: 2,
      status: 'published',
    },
    {
      name: 'Linda Kusi',
      company: 'LearnLoop',
      sector: 'Technology',
      location: 'Accra, Ghana',
      funding_amount: '$35,000',
      funding_date: '2025-09-10',
      description: 'Built an offline-first learning app for low-bandwidth school environments.',
      impact_metrics: '50 schools adopted; 12,000 learners reached',
      featured: false,
      display_order: 3,
      status: 'published',
    },
  ];

  let inserted = 0;
  let updated = 0;
  for (const story of successStories) {
    const action = await upsertByMatch({
      table: 'success_stories',
      match: { name: story.name, company: story.company },
      payload: story,
    });
    if (action === 'inserted') inserted++;
    if (action === 'updated') updated++;
  }
  console.log(`Success stories: ${inserted} inserted, ${updated} updated`);
}

async function seedPartners() {
  const partners = [
    {
      name: 'Impact Ventures Ghana',
      description: 'Early-stage support for founders building high-impact products.',
      website_url: 'https://example.com/impact-ventures-ghana',
      sector: 'Technology',
      featured: true,
      status: 'active',
    },
    {
      name: 'AgriGrowth Network',
      description: 'Partnering with agribusinesses and cooperatives across the region.',
      website_url: 'https://example.com/agrigrowth-network',
      sector: 'Agriculture',
      featured: true,
      status: 'active',
    },
    {
      name: 'PanAfrica Finance Hub',
      description: 'Supporting financial inclusion and digital payments innovation.',
      website_url: 'https://example.com/panafrica-finance-hub',
      sector: 'FinTech',
      featured: false,
      status: 'active',
    },
  ];

  let inserted = 0;
  let updated = 0;
  for (const partner of partners) {
    const action = await upsertByMatch({
      table: 'partners',
      match: { name: partner.name },
      payload: partner,
    });
    if (action === 'inserted') inserted++;
    if (action === 'updated') updated++;
  }
  console.log(`Partners: ${inserted} inserted, ${updated} updated`);
}

async function seedResources() {
  const files = [
    {
      diskName: 'test-document.pdf',
      title: 'Application Guidelines PDF',
      description: 'Sample PDF guide for applicants.',
      file_type: 'pdf',
      Sector: 'Application Guides',
      mimeType: 'application/pdf',
    },
    {
      diskName: 'test-document.doc',
      title: 'Business Template DOC',
      description: 'Sample Word template resource.',
      file_type: 'word',
      Sector: 'Templates',
      mimeType: 'application/msword',
    },
    {
      diskName: 'test-document.txt.docx',
      title: 'Business Template DOCX',
      description: 'Sample DOCX template resource.',
      file_type: 'word',
      Sector: 'Templates',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    {
      diskName: 'text-document.txt',
      title: 'Program Checklist TXT',
      description: 'Sample checklist document for applications.',
      file_type: 'word',
      Sector: 'Tools',
      mimeType: 'text/plain',
    },
  ];

  let inserted = 0;
  let updated = 0;

  for (const fileDef of files) {
    const localPath = path.join(TEST_FILES_DIR, fileDef.diskName);
    const buffer = await readFile(localPath);
    const storagePath = `seed/resources/${fileDef.diskName}`;

    const { error: uploadError } = await supabase.storage
      .from('resource-files')
      .upload(storagePath, buffer, { upsert: true, contentType: fileDef.mimeType });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from('resource-files').getPublicUrl(storagePath);

    const action = await upsertByMatch({
      table: 'resources',
      match: { title: fileDef.title },
      payload: {
        title: fileDef.title,
        description: fileDef.description,
        Sector: fileDef.Sector,
        file_type: fileDef.file_type,
        file_url: publicData.publicUrl,
        file_size: buffer.length,
        is_featured: false,
        is_published: true,
      },
    });
    if (action === 'inserted') inserted++;
    if (action === 'updated') updated++;
  }

  console.log(`Resources: ${inserted} inserted, ${updated} updated`);
}

async function main() {
  try {
    console.log('Seeding content...');
    await verifySupabaseHost();
    await seedMentors();
    await seedFaqs();
    await seedSuccessStories();
    await seedPartners();
    await seedResources();
    console.log('Seed complete.');
  } catch (error) {
    console.error('Seed failed:', error.message || error);
    process.exit(1);
  }
}

main();
