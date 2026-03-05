-- Seed data for categories and projects tables
-- This file can be run manually in Supabase SQL Editor or via Supabase CLI
--
-- Note: created_by is set to NULL since we don't have admin users yet
-- You can update these after creating admin users

-- ============================================
-- STEP 1: Insert Categories
-- ============================================
-- Insert categories first (required for projects.category_id foreign key)
INSERT INTO categories (name, slug, description, is_active)
VALUES
  ('Technology', 'technology', 'Technology and innovation projects', true),
  ('FinTech', 'fintech', 'Financial technology and payment solutions', true),
  ('Agriculture', 'agriculture', 'Agricultural innovation and food security projects', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- STEP 2: Insert Projects
-- ============================================
-- Technology Projects
INSERT INTO projects (
  title, description, category, category_id, status, deadline, funding_amount,
  location, image_url, requirements, eligibility_criteria, application_fee,
  max_applicants, current_applicants, featured
)
VALUES
  (
    'African Women Tech Entrepreneurs Grant',
    'Supporting women-led tech startups across Africa with funding and mentorship. This grant aims to bridge the gender gap in technology entrepreneurship by providing financial support, business mentorship, and access to networks for women building innovative tech solutions.',
    'Technology',
    (SELECT id FROM categories WHERE name = 'Technology' LIMIT 1),
    'closed',
    '2025-12-15',
    '$50,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
    'Business plan' || E'\n' || 'Pitch deck' || E'\n' || 'Financial projections' || E'\n' || 'Team bios' || E'\n' || 'Proof of concept or MVP',
    'Women-led tech startups' || E'\n' || 'Registered business' || E'\n' || 'Operating in Africa' || E'\n' || 'Minimum 6 months in operation' || E'\n' || 'Innovative tech solution',
    0.00,
    50,
    234,
    false
  ),
  (
    'FinTech for Financial Inclusion',
    'Supporting fintech solutions that promote financial inclusion across Africa. This opportunity focuses on innovative payment systems, mobile banking, microfinance platforms, and other technologies that bring financial services to underserved communities.',
    'FinTech',
    (SELECT id FROM categories WHERE name = 'FinTech' LIMIT 1),
    'open',
    '2025-10-20',
    '$75,000',
    'West Africa',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    'Technical documentation' || E'\n' || 'Regulatory compliance proof' || E'\n' || 'User acquisition metrics' || E'\n' || 'Scalability plan',
    'FinTech startup' || E'\n' || 'Focus on financial inclusion' || E'\n' || 'Operating in West Africa' || E'\n' || 'Regulatory compliance' || E'\n' || 'Demonstrable impact',
    25.00,
    30,
    89,
    true
  ),
  (
    'AI and Machine Learning Innovation Fund',
    'Funding for African startups developing AI and ML solutions for local challenges. This includes healthcare AI, agricultural tech, education platforms, and other applications that leverage artificial intelligence to solve African problems.',
    'Technology',
    (SELECT id FROM categories WHERE name = 'Technology' LIMIT 1),
    'open',
    '2027-11-30',
    '$100,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800',
    'Technical architecture' || E'\n' || 'AI/ML model documentation' || E'\n' || 'Data privacy compliance' || E'\n' || 'Use case validation',
    'AI/ML focused startup' || E'\n' || 'Clear technical roadmap' || E'\n' || 'Data-driven solution' || E'\n' || 'Ethical AI practices' || E'\n' || 'African market focus',
    20.00,
    20,
    45,
    true
  ),
  (
    'E-commerce Platform Development Grant',
    'Supporting the development of e-commerce platforms that connect African businesses with local and international markets. Focus on platforms that enable small and medium enterprises to sell online.',
    'Technology',
    (SELECT id FROM categories WHERE name = 'Technology' LIMIT 1),
    'open',
    '2028-01-15',
    '$40,000',
    'East Africa',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    'Platform demo' || E'\n' || 'Business model' || E'\n' || 'Market analysis' || E'\n' || 'User acquisition strategy',
    'E-commerce platform' || E'\n' || 'Focus on SMEs' || E'\n' || 'Operating in East Africa' || E'\n' || 'Early-stage to growth stage',
    10.00,
    40,
    0,
    false
  ),
  -- Agriculture Projects
  (
    'Sustainable Agriculture Innovation Fund',
    'Funding innovative agricultural solutions for food security in rural communities. This includes smart farming technologies, irrigation systems, crop management apps, and sustainable farming practices.',
    'Agriculture',
    (SELECT id FROM categories WHERE name = 'Agriculture' LIMIT 1),
    'open',
    '2027-11-30',
    '$25,000',
    'East Africa',
    'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
    'Project proposal' || E'\n' || 'Impact assessment' || E'\n' || 'Sustainability plan' || E'\n' || 'Community engagement strategy',
    'Agriculture-focused solution' || E'\n' || 'Rural community focus' || E'\n' || 'Sustainable practices' || E'\n' || 'Demonstrable impact on food security',
    10.00,
    60,
    156,
    false
  ),
  (
    'Smart Irrigation System for Smallholder Farmers',
    'Develop affordable IoT-based irrigation solutions to help smallholder farmers optimize water usage and increase crop yields in sub-Saharan Africa.',
    'Agriculture',
    (SELECT id FROM categories WHERE name = 'Agriculture' LIMIT 1),
    'open',
    '2027-12-20',
    '$60,000',
    'Sub-Saharan Africa',
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800',
    'Technical specifications' || E'\n' || 'Prototype or MVP' || E'\n' || 'Cost analysis' || E'\n' || 'Deployment plan',
    'IoT/tech solution for agriculture' || E'\n' || 'Focus on smallholder farmers' || E'\n' || 'Water efficiency' || E'\n' || 'Scalable technology',
    15.00,
    25,
    78,
    true
  ),
  (
    'AgriTech Supply Chain Innovation',
    'Supporting technology solutions that improve agricultural supply chains, reduce post-harvest losses, and connect farmers directly with markets.',
    'Agriculture',
    (SELECT id FROM categories WHERE name = 'Agriculture' LIMIT 1),
    'open',
    '2027-10-10',
    '$35,000',
    'West Africa',
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
    'Supply chain analysis' || E'\n' || 'Technology solution' || E'\n' || 'Market connections' || E'\n' || 'Impact metrics',
    'Supply chain solution' || E'\n' || 'Focus on reducing losses' || E'\n' || 'Market connectivity' || E'\n' || 'West African operations',
    20.00,
    35,
    92,
    false
  ),
  -- FinTech Projects
  (
    'Mobile Money Solutions Grant',
    'Funding for innovative mobile money and payment solutions that increase financial access in underserved African communities.',
    'FinTech',
    (SELECT id FROM categories WHERE name = 'FinTech' LIMIT 1),
    'open',
    '2027-12-05',
    '$55,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
    'Technical documentation' || E'\n' || 'Security audit' || E'\n' || 'Regulatory compliance' || E'\n' || 'User testing results',
    'Mobile payment solution' || E'\n' || 'Financial inclusion focus' || E'\n' || 'Security compliance' || E'\n' || 'Regulatory approval',
    15.00,
    45,
    123,
    false
  ),
  (
    'Cryptocurrency and Blockchain for Development',
    'Supporting blockchain and cryptocurrency solutions that address real-world development challenges in Africa, such as remittances, identity verification, and transparent governance.',
    'FinTech',
    (SELECT id FROM categories WHERE name = 'FinTech' LIMIT 1),
    'open',
    '2028-02-28',
    '$80,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
    'Blockchain architecture' || E'\n' || 'Whitepaper' || E'\n' || 'Use case validation' || E'\n' || 'Technical roadmap',
    'Blockchain/crypto solution' || E'\n' || 'Development focus' || E'\n' || 'Clear use case' || E'\n' || 'Technical feasibility',
    25.00,
    15,
    0,
    true
  ),
  -- Additional Technology Projects
  (
    'EdTech Innovation for Rural Education',
    'Supporting educational technology platforms that improve access to quality education in rural and underserved African communities.',
    'Technology',
    (SELECT id FROM categories WHERE name = 'Technology' LIMIT 1),
    'open',
    '2027-11-25',
    '$45,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1503676260728-1c6019ae5030?w=800',
    'Educational content' || E'\n' || 'Platform demo' || E'\n' || 'Impact assessment' || E'\n' || 'Scalability plan',
    'EdTech platform' || E'\n' || 'Rural focus' || E'\n' || 'Quality education access' || E'\n' || 'Scalable solution',
    5.00,
    50,
    167,
    false
  ),
  (
    'Healthcare Technology Innovation',
    'Funding for health tech solutions that improve healthcare delivery, telemedicine, health records management, and access to medical services in Africa.',
    'Technology',
    (SELECT id FROM categories WHERE name = 'Technology' LIMIT 1),
    'open',
    '2027-12-10',
    '$65,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800',
    'Medical compliance documentation' || E'\n' || 'Platform demo' || E'\n' || 'Healthcare professional validation' || E'\n' || 'Privacy compliance',
    'Health tech solution' || E'\n' || 'Healthcare improvement focus' || E'\n' || 'Regulatory compliance' || E'\n' || 'Medical professional support',
    30.00,
    30,
    98,
    false
  ),
  (
    'Green Energy Technology Fund',
    'Supporting renewable energy solutions including solar, wind, and hydro technologies that provide clean energy access to African communities.',
    'Technology',
    (SELECT id FROM categories WHERE name = 'Technology' LIMIT 1),
    'open',
    '2027-10-15',
    '$90,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
    'Technical specifications' || E'\n' || 'Environmental impact assessment' || E'\n' || 'Cost-benefit analysis' || E'\n' || 'Deployment strategy',
    'Renewable energy solution' || E'\n' || 'Clean energy focus' || E'\n' || 'African community access' || E'\n' || 'Technical feasibility',
    20.00,
    20,
    67,
    true
  ),
  (
    'Transportation and Logistics Tech',
    'Funding for technology solutions that improve transportation, logistics, and mobility in African cities and rural areas.',
    'Technology',
    (SELECT id FROM categories WHERE name = 'Technology' LIMIT 1),
    'open',
    '2028-01-30',
    '$50,000',
    'Pan-African',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Business model' || E'\n' || 'Technology solution' || E'\n' || 'Market analysis' || E'\n' || 'Scalability plan',
    'Transport/logistics solution' || E'\n' || 'African market focus' || E'\n' || 'Innovative approach' || E'\n' || 'Scalable technology',
    10.00,
    40,
    0,
    false
  );

-- Update sequences to continue from the inserted IDs
SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id) FROM projects), 1), false);
SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1), false);
