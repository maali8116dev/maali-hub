-- Create mentors table
CREATE TABLE public.mentors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    bio TEXT,
    expertise_areas TEXT[] DEFAULT '{}',
    sector TEXT,
    country TEXT,
    linkedin_url TEXT,
    twitter_url TEXT,
    website_url TEXT,
    avatar_url TEXT,
    is_published BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

-- Public can view published mentors
CREATE POLICY "Published mentors are viewable by everyone"
    ON public.mentors FOR SELECT
    USING (is_published = true);

-- Admins can view all mentors
CREATE POLICY "Admins can view all mentors"
    ON public.mentors FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can create mentors
CREATE POLICY "Admins can create mentors"
    ON public.mentors FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update mentors
CREATE POLICY "Admins can update mentors"
    ON public.mentors FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can delete mentors
CREATE POLICY "Admins can delete mentors"
    ON public.mentors FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_mentors_updated_at
    BEFORE UPDATE ON public.mentors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample mentors
INSERT INTO public.mentors (name, bio, expertise_areas, sector, country, linkedin_url, twitter_url, website_url, is_published, display_order) VALUES
('Dr. Amina Osei', 'Serial entrepreneur with 15+ years experience in agribusiness. Founded three successful agricultural startups across West Africa.', ARRAY['Business Strategy', 'Fundraising', 'Market Expansion'], 'Agriculture', 'Ghana', 'https://linkedin.com/in/example', 'https://twitter.com/example', 'https://example.com', true, 1),
('Chinedu Okoro', 'Fintech pioneer and angel investor. Former VP of Product at a leading African payment platform.', ARRAY['Fintech', 'Product Development', 'Investor Relations'], 'Financial Services', 'Nigeria', 'https://linkedin.com/in/example', NULL, NULL, true, 2),
('Fatima Hassan', 'Tech ecosystem builder and startup accelerator director. Passionate about supporting women entrepreneurs.', ARRAY['Startup Acceleration', 'Team Building', 'Pitch Coaching'], 'Technology', 'Kenya', 'https://linkedin.com/in/example', 'https://twitter.com/example', 'https://example.com', true, 3),
('Kwame Asante', 'Impact investor and sustainability consultant. Specialized in renewable energy ventures across Africa.', ARRAY['Impact Investment', 'Sustainability', 'Clean Energy'], 'Energy', 'Ghana', 'https://linkedin.com/in/example', NULL, 'https://example.com', true, 4),
('Nadia Benali', 'Marketing expert with experience scaling brands across North and Sub-Saharan Africa.', ARRAY['Marketing Strategy', 'Brand Building', 'Digital Marketing'], 'Marketing', 'Morocco', 'https://linkedin.com/in/example', 'https://twitter.com/example', NULL, true, 5),
('Samuel Mwangi', 'Operations specialist who has helped over 50 startups optimize their supply chains and logistics.', ARRAY['Operations', 'Supply Chain', 'Process Optimization'], 'Logistics', 'Kenya', 'https://linkedin.com/in/example', NULL, NULL, true, 6),
('Zainab Diallo', 'Healthcare entrepreneur and public health advocate. Built telemedicine solutions serving rural communities.', ARRAY['Healthcare', 'Telemedicine', 'Social Enterprise'], 'Healthcare', 'Senegal', 'https://linkedin.com/in/example', 'https://twitter.com/example', 'https://example.com', true, 7),
('David Okonkwo', 'Former CTO turned startup advisor. Expertise in building and scaling engineering teams.', ARRAY['Technical Leadership', 'Software Architecture', 'Hiring'], 'Technology', 'Nigeria', 'https://linkedin.com/in/example', NULL, NULL, true, 8);