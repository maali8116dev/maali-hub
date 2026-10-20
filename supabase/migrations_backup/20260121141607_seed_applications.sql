-- Seed applications table with sample data
-- This migration creates sample applications for testing and development

-- First, ensure we have some test users if they don't exist
-- We'll create applications that reference existing users or use a placeholder approach
DO $$
DECLARE
  test_user_ids UUID[];
  project_ids INTEGER[];
  app_count INTEGER := 0;
BEGIN
  -- Get existing user IDs from profiles (limit to first 10 for seeding)
  SELECT ARRAY_AGG(user_id) INTO test_user_ids
  FROM public.profiles
  LIMIT 10;
  
  -- Get existing project IDs
  SELECT ARRAY_AGG(id ORDER BY id) INTO project_ids
  FROM public.projects;
  
  -- If no users exist, we'll create applications with NULL user_id (for testing)
  -- In production, applications should always have a user_id
  
  -- Only seed if we have projects and applications don't already exist
  IF project_ids IS NOT NULL AND array_length(project_ids, 1) > 0 
     AND NOT EXISTS (SELECT 1 FROM public.applications LIMIT 1) THEN
    
    -- Insert sample applications with various statuses
    INSERT INTO public.applications (
      user_id,
      project_id,
      company_name,
      contact_email,
      contact_phone,
      project_description,
      funding_amount_requested,
      business_plan,
      team_size,
      location,
      status,
      application_fee_paid,
      is_draft,
      created_at,
      updated_at
    ) VALUES
    -- Pending Applications
    (
      CASE WHEN array_length(test_user_ids, 1) > 0 THEN test_user_ids[1] ELSE NULL END,
      project_ids[1],
      'AgriTech Solutions Ltd',
      'contact@agritech-solutions.africa',
      '+234 801 234 5678',
      'We are developing an innovative mobile platform that connects smallholder farmers with buyers, providing real-time market prices, weather forecasts, and agricultural best practices. Our solution addresses food security challenges by reducing post-harvest losses and improving farmer incomes.',
      '$50,000',
      'Our business plan includes a comprehensive market analysis, competitive landscape review, financial projections for the next 3 years, and a detailed go-to-market strategy. We have already piloted with 500 farmers in Nigeria and achieved 30% increase in farmer incomes.',
      8,
      'Lagos, Nigeria',
      'pending',
      true,
      false,
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '5 days'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 1 THEN test_user_ids[2] ELSE NULL END,
      project_ids[1],
      'Green Energy Innovations',
      'info@greenenergy.africa',
      '+254 712 345 678',
      'We are building solar-powered irrigation systems specifically designed for small-scale farmers in East Africa. Our technology reduces water usage by 40% while increasing crop yields through precision irrigation.',
      '$75,000',
      'Our business model focuses on pay-as-you-go financing, making our systems affordable for smallholder farmers. We have partnerships with 3 microfinance institutions and have installed 200 systems in Kenya.',
      12,
      'Nairobi, Kenya',
      'pending',
      false,
      false,
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '3 days'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 2 THEN test_user_ids[3] ELSE NULL END,
      project_ids[2],
      'FinTech Mobile Solutions',
      'hello@fintechmobile.africa',
      '+233 241 567 890',
      'We are creating a mobile banking platform that enables unbanked populations in rural areas to access financial services. Our app works on basic feature phones and requires minimal data usage.',
      '$100,000',
      'We have conducted extensive market research in Ghana and Nigeria, identifying a market of 60 million unbanked adults. Our MVP has been tested with 1,000 users showing 85% satisfaction rate.',
      15,
      'Accra, Ghana',
      'pending',
      true,
      false,
      NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '7 days'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 0 THEN test_user_ids[1] ELSE NULL END,
      project_ids[3],
      'AI Healthcare Diagnostics',
      'contact@aihealth.africa',
      '+27 11 234 5678',
      'We are developing an AI-powered diagnostic tool that helps healthcare workers in rural clinics diagnose common diseases using smartphone cameras. Our solution addresses the shortage of medical specialists in rural Africa.',
      '$60,000',
      'Our technology has been validated through partnerships with 5 rural clinics in South Africa. We have achieved 92% accuracy in diagnosing malaria, tuberculosis, and skin conditions.',
      10,
      'Cape Town, South Africa',
      'pending',
      false,
      false,
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '2 days'
    ),
    
    -- Under Review Applications
    (
      CASE WHEN array_length(test_user_ids, 1) > 1 THEN test_user_ids[2] ELSE NULL END,
      project_ids[2],
      'EduTech Learning Platform',
      'info@edutech.africa',
      '+234 802 345 6789',
      'We are building an offline-first educational platform that provides quality learning materials to students in areas with limited internet connectivity. Our platform works on low-end smartphones and tablets.',
      '$80,000',
      'We have developed partnerships with 20 schools in Nigeria and have created content aligned with the national curriculum. Our pilot showed 40% improvement in student test scores.',
      14,
      'Abuja, Nigeria',
      'under_review',
      true,
      false,
      NOW() - INTERVAL '10 days',
      NOW() - INTERVAL '1 day'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 2 THEN test_user_ids[3] ELSE NULL END,
      project_ids[1],
      'Sustainable Agriculture Co-op',
      'contact@sustainable-agri.africa',
      '+254 723 456 789',
      'We are establishing a cooperative model that helps smallholder farmers access premium markets through collective bargaining, quality standardization, and direct buyer relationships.',
      '$45,000',
      'We have successfully organized 200 farmers into our cooperative and secured contracts with 3 major retailers. Our farmers have seen 50% increase in income through better pricing.',
      6,
      'Kisumu, Kenya',
      'under_review',
      true,
      false,
      NOW() - INTERVAL '8 days',
      NOW() - INTERVAL '2 days'
    ),
    
    -- Approved Applications
    (
      CASE WHEN array_length(test_user_ids, 1) > 0 THEN test_user_ids[1] ELSE NULL END,
      CASE WHEN array_length(project_ids, 1) >= 4 THEN project_ids[4] ELSE project_ids[1] END,
      'Clean Water Access Initiative',
      'info@cleanwater.africa',
      '+233 242 678 901',
      'We are deploying low-cost water purification systems in rural communities across West Africa. Our solar-powered filtration units provide clean drinking water to communities without access to clean water sources.',
      '$90,000',
      'We have installed 50 systems serving 10,000 people in Ghana. Our impact metrics show 60% reduction in waterborne diseases and 3 hours saved daily per household in water collection time.',
      18,
      'Kumasi, Ghana',
      'approved',
      true,
      false,
      NOW() - INTERVAL '30 days',
      NOW() - INTERVAL '15 days'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 1 THEN test_user_ids[2] ELSE NULL END,
      project_ids[3],
      'Women Empowerment Marketplace',
      'hello@womenmarketplace.africa',
      '+27 12 345 6789',
      'We are creating an e-commerce platform specifically for women entrepreneurs to sell their products. Our platform provides marketing support, logistics, and financial services tailored to women-owned businesses.',
      '$70,000',
      'We have onboarded 500 women sellers and processed $200,000 in sales in our first 6 months. Our sellers report average 35% increase in monthly income.',
      20,
      'Johannesburg, South Africa',
      'approved',
      true,
      false,
      NOW() - INTERVAL '25 days',
      NOW() - INTERVAL '10 days'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 2 THEN test_user_ids[3] ELSE NULL END,
      project_ids[2],
      'Rural Connectivity Solutions',
      'contact@ruralconnect.africa',
      '+234 803 456 7890',
      'We are deploying low-cost WiFi hotspots in rural communities, providing affordable internet access to underserved areas. Our model includes community ownership and local entrepreneurship.',
      '$55,000',
      'We have established 30 hotspots serving 5,000 users in rural Nigeria. Our revenue model includes subscription fees and local advertising, achieving 70% cost recovery.',
      9,
      'Kaduna, Nigeria',
      'approved',
      true,
      false,
      NOW() - INTERVAL '20 days',
      NOW() - INTERVAL '5 days'
    ),
    
    -- Rejected Applications
    (
      CASE WHEN array_length(test_user_ids, 1) > 0 THEN test_user_ids[1] ELSE NULL END,
      CASE WHEN array_length(project_ids, 1) >= 5 THEN project_ids[5] ELSE project_ids[1] END,
      'Tech Startup Alpha',
      'info@techalpha.africa',
      '+254 734 567 890',
      'We are developing a social media platform for African youth to connect and share content.',
      '$120,000',
      'Our business plan outlines growth strategies and monetization through advertising.',
      5,
      'Nairobi, Kenya',
      'rejected',
      false,
      false,
      NOW() - INTERVAL '40 days',
      NOW() - INTERVAL '35 days'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 1 THEN test_user_ids[2] ELSE NULL END,
      project_ids[1],
      'Quick Commerce Delivery',
      'contact@quickcommerce.africa',
      '+233 243 789 012',
      'We want to build a food delivery app similar to existing platforms.',
      '$95,000',
      'We plan to compete with existing delivery services in major cities.',
      7,
      'Accra, Ghana',
      'rejected',
      true,
      false,
      NOW() - INTERVAL '35 days',
      NOW() - INTERVAL '30 days'
    ),
    
    -- Draft Applications (not submitted)
    (
      CASE WHEN array_length(test_user_ids, 1) > 2 THEN test_user_ids[3] ELSE NULL END,
      project_ids[3],
      'Renewable Energy Co-op',
      'info@renewablecoop.africa',
      '+27 13 456 7890',
      'We are forming a cooperative to help communities access renewable energy solutions through group purchasing and shared ownership.',
      '$65,000',
      NULL,
      11,
      'Durban, South Africa',
      'draft',
      false,
      true,
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day'
    ),
    (
      CASE WHEN array_length(test_user_ids, 1) > 0 THEN test_user_ids[1] ELSE NULL END,
      CASE WHEN array_length(project_ids, 1) >= 4 THEN project_ids[4] ELSE project_ids[1] END,
      'Digital Skills Academy',
      'hello@digitalskills.africa',
      '+234 804 567 8901',
      'We are creating an online academy that teaches digital skills to young Africans, focusing on web development, digital marketing, and data analysis.',
      '$85,000',
      NULL,
      13,
      'Lagos, Nigeria',
      'draft',
      false,
      true,
      NOW() - INTERVAL '3 hours',
      NOW() - INTERVAL '3 hours'
    );
    
    GET DIAGNOSTICS app_count = ROW_COUNT;
    
    -- Log the number of applications created
    RAISE NOTICE 'Seeded % applications', app_count;
    
  ELSE
    RAISE NOTICE 'No projects found. Please seed projects first before seeding applications.';
  END IF;
END $$;

-- Update project current_applicants count based on seeded applications
UPDATE public.projects p
SET current_applicants = (
  SELECT COUNT(*)
  FROM public.applications a
  WHERE a.project_id = p.id
    AND a.is_draft = false
    AND a.status != 'draft'
)
WHERE EXISTS (
  SELECT 1
  FROM public.applications a
  WHERE a.project_id = p.id
);

