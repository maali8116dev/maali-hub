-- Seed data for sectors and opportunities tables
-- Run in Supabase SQL Editor or via CLI

-- ============================================
-- STEP 1: Insert Sectors
-- ============================================
INSERT INTO sectors (name, slug, description, is_active)
VALUES
  ('Technology', 'technology', 'Technology and innovation opportunities', true),
  ('FinTech', 'fintech', 'Financial technology and payment solutions', true),
  ('Agriculture', 'agriculture', 'Agricultural innovation and food security opportunities', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- STEP 2: Insert Opportunity Tags
-- ============================================
INSERT INTO opportunity_tags (name, slug)
VALUES
  ('AI/ML', 'ai-ml'),
  ('Blockchain', 'blockchain'),
  ('IoT', 'iot'),
  ('Mobile', 'mobile'),
  ('Women-led', 'women-led'),
  ('Climate', 'climate'),
  ('Health', 'health'),
  ('Education', 'education'),
  ('Supply Chain', 'supply-chain'),
  ('Renewable Energy', 'renewable-energy')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- STEP 3: Insert Opportunities
-- ============================================
INSERT INTO opportunities (
  title, description, sector_id, status, opportunity_type, program_format,
  funding_type, experience_level, deadline, start_date, end_date,
  funding_amount, currency, location, country,
  image_url, requirements, eligibility_criteria,
  application_fee, max_applicants, current_applicants, featured
)
VALUES
  (
    'African Women Tech Entrepreneurs Grant',
    'Supporting women-led tech startups across Africa with funding and mentorship. This grant aims to bridge the gender gap in technology entrepreneurship by providing financial support, business mentorship, and access to networks for women building innovative tech solutions.',
    (SELECT id FROM sectors WHERE slug = 'technology' LIMIT 1),
    'closed', 'grant', 'hybrid', 'no_funding', 'startup_founder',
    '2025-12-15', '2026-01-15', '2026-12-15',
    '50000', 'USD', 'Pan-African', 'KE',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
    'Business plan' || E'\n' || 'Pitch deck' || E'\n' || 'Financial projections' || E'\n' || 'Team bios' || E'\n' || 'Proof of concept or MVP',
    'Women-led tech startups' || E'\n' || 'Registered business' || E'\n' || 'Operating in Africa' || E'\n' || 'Minimum 6 months in operation',
    0.00, 50, 234, false
  ),
  (
    'FinTech for Financial Inclusion',
    'Supporting fintech solutions that promote financial inclusion across Africa. This opportunity focuses on innovative payment systems, mobile banking, microfinance platforms, and other technologies that bring financial services to underserved communities.',
    (SELECT id FROM sectors WHERE slug = 'fintech' LIMIT 1),
    'open', 'grant', 'in_person', 'no_funding', 'mid_career',
    '2025-10-20', '2025-11-01', '2026-10-20',
    '75000', 'USD', 'West Africa', 'NG',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    'Technical documentation' || E'\n' || 'Regulatory compliance proof' || E'\n' || 'User acquisition metrics' || E'\n' || 'Scalability plan',
    'FinTech startup' || E'\n' || 'Focus on financial inclusion' || E'\n' || 'Operating in West Africa' || E'\n' || 'Regulatory compliance',
    25.00, 30, 89, true
  ),
  (
    'AI and Machine Learning Innovation Fund',
    'Funding for African startups developing AI and ML solutions for local challenges including healthcare, agriculture, education, and more.',
    (SELECT id FROM sectors WHERE slug = 'technology' LIMIT 1),
    'open', 'accelerator', 'hybrid', 'equity', 'startup_founder',
    '2027-11-30', '2028-01-15', '2028-07-15',
    '100000', 'USD', 'Pan-African', NULL,
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800',
    'Technical architecture' || E'\n' || 'AI/ML model documentation' || E'\n' || 'Data privacy compliance' || E'\n' || 'Use case validation',
    'AI/ML focused startup' || E'\n' || 'Clear technical roadmap' || E'\n' || 'Ethical AI practices' || E'\n' || 'African market focus',
    20.00, 20, 45, true
  ),
  (
    'E-commerce Platform Development Fellowship',
    'A 12-month fellowship supporting the development of e-commerce platforms that connect African businesses with local and international markets.',
    (SELECT id FROM sectors WHERE slug = 'technology' LIMIT 1),
    'open', 'fellowship', 'online', 'equity', 'mid_career',
    '2028-01-15', '2028-03-01', '2029-03-01',
    '40000', 'USD', 'East Africa', 'KE',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    'Platform demo' || E'\n' || 'Business model' || E'\n' || 'Market analysis' || E'\n' || 'User acquisition strategy',
    'E-commerce platform' || E'\n' || 'Focus on SMEs' || E'\n' || 'Operating in East Africa',
    10.00, 40, 0, false
  ),
  (
    'Sustainable Agriculture Innovation Fund',
    'Funding innovative agricultural solutions for food security in rural communities including smart farming, irrigation, and sustainable practices.',
    (SELECT id FROM sectors WHERE slug = 'agriculture' LIMIT 1),
    'open', 'grant', 'in_person', 'fully_funded', 'early_career',
    '2027-11-30', '2028-01-01', '2028-12-31',
    '25000', 'USD', 'East Africa', 'TZ',
    'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
    'Project proposal' || E'\n' || 'Impact assessment' || E'\n' || 'Sustainability plan' || E'\n' || 'Community engagement strategy',
    'Agriculture-focused solution' || E'\n' || 'Rural community focus' || E'\n' || 'Sustainable practices',
    10.00, 60, 156, false
  ),
  (
    'Smart Irrigation Training Program',
    'Hands-on training program for developing affordable IoT-based irrigation solutions to help smallholder farmers optimize water usage across sub-Saharan Africa.',
    (SELECT id FROM sectors WHERE slug = 'agriculture' LIMIT 1),
    'open', 'training', 'hybrid', 'no_funding', 'student',
    '2027-12-20', '2028-02-01', '2028-05-01',
    '60000', 'USD', 'Sub-Saharan Africa', NULL,
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800',
    'Technical specifications' || E'\n' || 'Prototype or MVP' || E'\n' || 'Cost analysis' || E'\n' || 'Deployment plan',
    'IoT/tech solution for agriculture' || E'\n' || 'Focus on smallholder farmers' || E'\n' || 'Scalable technology',
    15.00, 25, 78, true
  ),
  (
    'AgriTech Supply Chain Competition',
    'Annual competition supporting technology solutions that improve agricultural supply chains, reduce post-harvest losses, and connect farmers directly with markets.',
    (SELECT id FROM sectors WHERE slug = 'agriculture' LIMIT 1),
    'open', 'competition', 'in_person', 'no_funding', 'mid_career',
    '2027-10-10', '2027-11-01', '2027-12-15',
    '35000', 'USD', 'West Africa', 'GH',
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
    'Supply chain analysis' || E'\n' || 'Technology solution' || E'\n' || 'Market connections' || E'\n' || 'Impact metrics',
    'Supply chain solution' || E'\n' || 'Focus on reducing losses' || E'\n' || 'West African operations',
    20.00, 35, 92, false
  ),
  (
    'Mobile Money Solutions Incubator',
    'A 6-month incubator for innovative mobile money and payment solutions that increase financial access in underserved African communities.',
    (SELECT id FROM sectors WHERE slug = 'fintech' LIMIT 1),
    'open', 'hackathon', 'hybrid', 'equity', 'startup_founder',
    '2027-12-05', '2028-01-15', '2028-07-15',
    '55000', 'USD', 'Pan-African', NULL,
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
    'Technical documentation' || E'\n' || 'Security audit' || E'\n' || 'Regulatory compliance' || E'\n' || 'User testing results',
    'Mobile payment solution' || E'\n' || 'Financial inclusion focus' || E'\n' || 'Security compliance',
    15.00, 45, 123, false
  ),
  (
    'Blockchain for Development Scholarship',
    'Scholarship program supporting researchers and developers working on blockchain solutions for African development challenges like remittances, identity, and governance.',
    (SELECT id FROM sectors WHERE slug = 'fintech' LIMIT 1),
    'open', 'scholarship', 'online', 'no_funding', 'graduate',
    '2028-02-28', '2028-04-01', '2029-04-01',
    '80000', 'USD', 'Pan-African', NULL,
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
    'Blockchain architecture' || E'\n' || 'Whitepaper' || E'\n' || 'Use case validation' || E'\n' || 'Technical roadmap',
    'Blockchain/crypto solution' || E'\n' || 'Development focus' || E'\n' || 'Clear use case',
    25.00, 15, 0, true
  ),
  (
    'EdTech Innovation Internship',
    'Paid internship program at leading EdTech companies building platforms that improve access to quality education in rural African communities.',
    (SELECT id FROM sectors WHERE slug = 'technology' LIMIT 1),
    'open', 'internship', 'online', 'no_funding', 'undergraduate',
    '2027-11-25', '2028-01-10', '2028-07-10',
    '45000', 'USD', 'Pan-African', NULL,
    'https://images.unsplash.com/photo-1503676260728-1c6019ae5030?w=800',
    'Educational content' || E'\n' || 'Platform demo' || E'\n' || 'Impact assessment' || E'\n' || 'Scalability plan',
    'EdTech platform' || E'\n' || 'Rural focus' || E'\n' || 'Quality education access',
    5.00, 50, 167, false
  ),
  (
    'Healthcare Technology Innovation Grant',
    'Funding for health tech solutions improving healthcare delivery, telemedicine, records management, and access to medical services across Africa.',
    (SELECT id FROM sectors WHERE slug = 'technology' LIMIT 1),
    'open', 'grant', 'hybrid', 'no_funding', 'mid_career',
    '2027-12-10', '2028-02-01', '2028-12-31',
    '65000', 'USD', 'Pan-African', NULL,
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800',
    'Medical compliance documentation' || E'\n' || 'Platform demo' || E'\n' || 'Healthcare professional validation' || E'\n' || 'Privacy compliance',
    'Health tech solution' || E'\n' || 'Healthcare improvement focus' || E'\n' || 'Regulatory compliance',
    30.00, 30, 98, false
  ),
  (
    'Green Energy Technology Accelerator',
    'Accelerator for renewable energy solutions including solar, wind, and hydro technologies providing clean energy access to African communities.',
    (SELECT id FROM sectors WHERE slug = 'technology' LIMIT 1),
    'open', 'accelerator', 'in_person', 'equity', 'mid_career',
    '2027-10-15', '2027-12-01', '2028-06-01',
    '90000', 'USD', 'Pan-African', NULL,
    'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
    'Technical specifications' || E'\n' || 'Environmental impact assessment' || E'\n' || 'Cost-benefit analysis' || E'\n' || 'Deployment strategy',
    'Renewable energy solution' || E'\n' || 'Clean energy focus' || E'\n' || 'Technical feasibility',
    20.00, 20, 67, true
  ),
  (
    'Transportation and Logistics Tech Job Board',
    'Job opportunities at startups building technology solutions for transportation, logistics, and mobility in African cities and rural areas.',
    (SELECT id FROM sectors WHERE slug = 'technology' LIMIT 1),
    'open', 'job', 'online', 'no_funding', 'professional',
    '2028-01-30', NULL, NULL,
    '50000', 'USD', 'Pan-African', NULL,
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Business model' || E'\n' || 'Technology solution' || E'\n' || 'Market analysis' || E'\n' || 'Scalability plan',
    'Transport/logistics solution' || E'\n' || 'African market focus' || E'\n' || 'Innovative approach',
    10.00, 40, 0, false
  );

-- ============================================
-- STEP 4: Map Tags to Opportunities
-- ============================================
INSERT INTO opportunity_tag_map (opportunity_id, tag_id)
SELECT o.id, t.id FROM opportunities o, opportunity_tags t
WHERE o.title = 'African Women Tech Entrepreneurs Grant' AND t.slug IN ('women-led', 'mobile')
UNION ALL
SELECT o.id, t.id FROM opportunities o, opportunity_tags t
WHERE o.title = 'AI and Machine Learning Innovation Fund' AND t.slug IN ('ai-ml', 'health', 'education')
UNION ALL
SELECT o.id, t.id FROM opportunities o, opportunity_tags t
WHERE o.title = 'Smart Irrigation Training Program' AND t.slug IN ('iot', 'climate')
UNION ALL
SELECT o.id, t.id FROM opportunities o, opportunity_tags t
WHERE o.title = 'Blockchain for Development Scholarship' AND t.slug IN ('blockchain', 'mobile')
UNION ALL
SELECT o.id, t.id FROM opportunities o, opportunity_tags t
WHERE o.title = 'AgriTech Supply Chain Competition' AND t.slug IN ('supply-chain', 'mobile')
UNION ALL
SELECT o.id, t.id FROM opportunities o, opportunity_tags t
WHERE o.title = 'Green Energy Technology Accelerator' AND t.slug IN ('renewable-energy', 'climate');

-- ============================================
-- STEP 5: Reset sequences
-- ============================================
SELECT setval('opportunities_id_seq', COALESCE((SELECT MAX(id) FROM opportunities), 1));
SELECT setval('sectors_id_seq', COALESCE((SELECT MAX(id) FROM sectors), 1));
SELECT setval('opportunity_tags_id_seq', COALESCE((SELECT MAX(id) FROM opportunity_tags), 1));
