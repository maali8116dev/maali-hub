-- Add comprehensive application fields for detailed application form
-- Applicant Information
ALTER TABLE public.applications 
  ADD COLUMN
IF NOT EXISTS applicant_type TEXT CHECK
(applicant_type IN
('Individual', 'Organization', 'Startup / SME', 'NGO / Non-profit', 'Research / Academic')),
ADD COLUMN
IF NOT EXISTS full_legal_name TEXT,
ADD COLUMN
IF NOT EXISTS organization_name TEXT,
ADD COLUMN
IF NOT EXISTS registration_id_number TEXT,
ADD COLUMN
IF NOT EXISTS country_of_residence TEXT,
ADD COLUMN
IF NOT EXISTS city_region TEXT;

-- Organizational Background (if applicable)
ALTER TABLE public.applications 
  ADD COLUMN
IF NOT EXISTS year_established INTEGER,
ADD COLUMN
IF NOT EXISTS core_mission_purpose TEXT,
ADD COLUMN
IF NOT EXISTS primary_sectors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN
IF NOT EXISTS primary_sector_other TEXT,
ADD COLUMN
IF NOT EXISTS key_team_members_roles TEXT,
ADD COLUMN
IF NOT EXISTS previous_grants_funding_received BOOLEAN DEFAULT false,
ADD COLUMN
IF NOT EXISTS previous_grants_funding_details TEXT;

-- Project Overview
ALTER TABLE public.applications 
  ADD COLUMN
IF NOT EXISTS project_title TEXT,
ADD COLUMN
IF NOT EXISTS project_summary TEXT,
ADD COLUMN
IF NOT EXISTS problem_statement TEXT,
ADD COLUMN
IF NOT EXISTS proposed_solution TEXT,
ADD COLUMN
IF NOT EXISTS target_beneficiaries TEXT,
ADD COLUMN
IF NOT EXISTS geographic_focus TEXT;

-- Compliance & Declarations
ALTER TABLE public.applications 
  ADD COLUMN
IF NOT EXISTS information_accurate_confirmed BOOLEAN DEFAULT false,
ADD COLUMN
IF NOT EXISTS conflict_of_interest_declared BOOLEAN DEFAULT false,
ADD COLUMN
IF NOT EXISTS reporting_requirements_agreed BOOLEAN DEFAULT false,
ADD COLUMN
IF NOT EXISTS data_processing_consented BOOLEAN DEFAULT false,
ADD COLUMN
IF NOT EXISTS declaration_date TIMESTAMP
WITH TIME ZONE;



