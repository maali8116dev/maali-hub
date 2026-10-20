-- Insert dummy activity logs for testing
INSERT INTO activity_logs (action_type, entity_type, entity_id, description, user_id, metadata) VALUES
('login', 'user', NULL, 'User logged in successfully', NULL, '{"browser": "Chrome", "os": "Windows"}'),
('create', 'project', '1', 'Created new project: Agricultural Innovation Fund', NULL, '{"title": "Agricultural Innovation Fund", "funding": "$50,000"}'),
('submit', 'application', 'app-001', 'Submitted application for Green Tech Initiative', NULL, '{"company": "EcoFarm Solutions", "amount": "$25,000"}'),
('update', 'project', '2', 'Updated project deadline and funding amount', NULL, '{"changes": ["deadline", "funding_amount"]}'),
('create', 'blog_post', '1', 'Published new blog post: Sustainable Farming Tips', NULL, '{"title": "Sustainable Farming Tips", "category": "Agriculture"}'),
('approve', 'application', 'app-002', 'Application approved for Youth Agribusiness Program', NULL, '{"applicant": "Fresh Harvest Co", "status": "approved"}'),
('delete', 'document', 'doc-123', 'Deleted outdated business plan document', NULL, '{"file_name": "old_business_plan.pdf"}'),
('view', 'project', '3', 'Viewed project details: Climate-Smart Agriculture', NULL, '{"project_title": "Climate-Smart Agriculture"}'),
('update', 'profile', 'profile-001', 'Updated user profile information', NULL, '{"fields_updated": ["bio", "business_sector"]}'),
('reject', 'application', 'app-003', 'Application rejected due to incomplete documentation', NULL, '{"reason": "Missing financial statements"}'),
('create', 'project', '4', 'Created new project: Women in Agriculture Grant', NULL, '{"title": "Women in Agriculture Grant", "funding": "$100,000"}'),
('logout', 'user', NULL, 'User logged out', NULL, NULL),
('submit', 'application', 'app-004', 'Submitted application for Rural Development Fund', NULL, '{"company": "AgriTech Innovators", "amount": "$75,000"}'),
('update', 'blog_post', '2', 'Updated blog post content and featured image', NULL, '{"title": "Getting Started with Grants"}'),
('create', 'document', 'doc-456', 'Uploaded new supporting document', NULL, '{"file_name": "financial_report_2024.pdf", "size": "2.4MB"}');