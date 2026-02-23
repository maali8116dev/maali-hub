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
    'Business plan, pitch deck, financial projections, team bios, proof of concept or MVP',
    'Women-led tech startups, registered business, operating in Africa, minimum 6 months in operation, innovative tech solution',
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
    'Technical documentation, regulatory compliance proof, user acquisition metrics, scalability plan',
    'FinTech startup, focus on financial inclusion, operating in West Africa, regulatory compliance, demonstrable impact',
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
    'Technical architecture, AI/ML model documentation, data privacy compliance, use case validation',
    'AI/ML focused startup, clear technical roadmap, data-driven solution, ethical AI practices, African market focus',
    0.00,
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
    'Platform demo, business model, market analysis, user acquisition strategy',
    'E-commerce platform, focus on SMEs, operating in East Africa, early-stage to growth stage',
    0.00,
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
    'Project proposal, impact assessment, sustainability plan, community engagement strategy',
    'Agriculture-focused solution, rural community focus, sustainable practices, demonstrable impact on food security',
    0.00,
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
    'Technical specifications, prototype or MVP, cost analysis, deployment plan',
    'IoT/tech solution for agriculture, focus on smallholder farmers, water efficiency, scalable technology',
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
    'Supply chain analysis, technology solution, market connections, impact metrics',
    'Supply chain solution, focus on reducing losses, market connectivity, West African operations',
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
    'Technical documentation, security audit, regulatory compliance, user testing results',
    'Mobile payment solution, financial inclusion focus, security compliance, regulatory approval',
    0.00,
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
    'Blockchain architecture, whitepaper, use case validation, technical roadmap',
    'Blockchain/crypto solution, development focus, clear use case, technical feasibility',
    0.00,
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
    'Educational content, platform demo, impact assessment, scalability plan',
    'EdTech platform, rural focus, quality education access, scalable solution',
    0.00,
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
    'Medical compliance documentation, platform demo, healthcare professional validation, privacy compliance',
    'Health tech solution, healthcare improvement focus, regulatory compliance, medical professional support',
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
    'Technical specifications, environmental impact assessment, cost-benefit analysis, deployment strategy',
    'Renewable energy solution, clean energy focus, African community access, technical feasibility',
    0.00,
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
    'Business model, technology solution, market analysis, scalability plan',
    'Transport/logistics solution, African market focus, innovative approach, scalable technology',
    0.00,
    40,
    0,
    false
  );

-- Update sequences to continue from the inserted IDs
SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id) FROM projects), 1), false);
SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1), false);
