#!/usr/bin/env node
/**
 * Seed script for Supabase database
 * Reads supabase/seed.sql and executes it via Supabase CLI
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const seedFile = join(rootDir, 'supabase', 'seed.sql');

try {
  console.log('Reading seed file...');
  const sql = readFileSync(seedFile, 'utf8');
  
  console.log('Executing seed SQL via Supabase CLI...');
  
  // Spawn supabase command and pipe SQL to stdin
  const supabase = spawn('supabase', ['db', 'execute'], {
    cwd: rootDir,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true,
  });
  
  // Write SQL to stdin
  supabase.stdin.write(sql);
  supabase.stdin.end();
  
  // Wait for process to complete
  supabase.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Seed data inserted successfully!');
    } else {
      console.error(`❌ Seed script exited with code ${code}`);
      process.exit(1);
    }
  });
  
  supabase.on('error', (error) => {
    console.error('❌ Error executing seed script:', error.message);
    console.error('Make sure Supabase CLI is installed and you are logged in.');
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Error reading seed file:', error.message);
  process.exit(1);
}

