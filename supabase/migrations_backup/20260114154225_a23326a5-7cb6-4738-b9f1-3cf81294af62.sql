-- Create faqs table
CREATE TABLE public.faqs (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Public can view published FAQs
CREATE POLICY "Published FAQs are viewable by everyone"
    ON public.faqs FOR SELECT
    USING (is_published = true);

-- Admins can view all FAQs (including unpublished)
CREATE POLICY "Admins can view all FAQs"
    ON public.faqs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can create FAQs
CREATE POLICY "Admins can create FAQs"
    ON public.faqs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update FAQs
CREATE POLICY "Admins can update FAQs"
    ON public.faqs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can delete FAQs
CREATE POLICY "Admins can delete FAQs"
    ON public.faqs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_faqs_updated_at
    BEFORE UPDATE ON public.faqs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed dummy FAQ data
INSERT INTO public.faqs (question, answer, category, display_order, is_published) VALUES
-- General Category
('What is Maali?', 'Maali is a funding opportunity hub designed to connect African entrepreneurs with funding opportunities, resources, and support. We provide a platform where entrepreneurs can discover funding opportunities, submit applications, and track their progress.', 'General', 1, true),
('Is Maali free to use?', 'Yes, creating an account and browsing opportunities on Maali is completely free. However, some funding opportunities may have application fees set by the funders themselves.', 'General', 2, true),
('Which countries does Maali serve?', 'Maali serves entrepreneurs across all African countries. We work with funders and partners throughout the continent to provide opportunities for African entrepreneurs regardless of their location.', 'General', 3, true),

-- Applications Category
('How do I apply for funding?', 'To apply for funding, first browse our available opportunities on the Projects page. When you find an opportunity that matches your business, click ''Apply Now'' and complete the multi-step application form. Make sure you have all required documents ready before starting.', 'Applications', 1, true),
('What documents do I need to apply?', 'Required documents typically include: business registration documents, business plan, financial statements or projections, identification documents, and any sector-specific documents. Each opportunity may have slightly different requirements, which will be listed in the application form.', 'Applications', 2, true),
('Can I save my application and complete it later?', 'Yes, you can save your application as a draft and return to complete it later. Your progress will be saved automatically, and you can access your draft applications from your dashboard.', 'Applications', 3, true),
('How long does the review process take?', 'Review times vary depending on the funding opportunity and the number of applications received. Typically, initial reviews take 2-4 weeks, but some opportunities may take longer. You''ll receive updates on your application status via email and in your dashboard.', 'Applications', 4, true),
('Can I apply for multiple opportunities at once?', 'Yes, you can apply for multiple funding opportunities simultaneously. Each application is independent, and you can track all your applications from your dashboard.', 'Applications', 5, true),

-- Payments Category
('Are there application fees?', 'Application fees vary by opportunity. Some opportunities are free to apply for, while others may have a small application fee set by the funder. All fees are clearly displayed before you submit your application.', 'Payments', 1, true),
('What payment methods do you accept?', 'We accept various payment methods including credit cards, mobile money, bank transfers, and PayPal. The available payment methods will be shown during the payment process.', 'Payments', 2, true),
('Is my payment information secure?', 'Yes, all payments are processed securely through Stripe, a leading payment processor. We never store your full payment card details on our servers.', 'Payments', 3, true),

-- Account and Profile Category
('How do I create an account?', 'Click on ''Sign Up'' in the navigation bar or visit the Auth page. You can create an account using your email address and password, or sign up with Google or Facebook for faster registration.', 'Account & Profile', 1, true),
('How do I update my profile?', 'You can update your profile information from your dashboard. Go to the Profile section to edit your personal details, business information, and upload documents.', 'Account & Profile', 2, true),
('What if I forget my password?', 'On the login page, click ''Forgot password?'' and enter your email address. We''ll send you a link to reset your password.', 'Account & Profile', 3, true);