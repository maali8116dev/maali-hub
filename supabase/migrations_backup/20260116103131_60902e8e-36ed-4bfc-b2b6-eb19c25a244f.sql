-- Add a permissive policy allowing anyone to view activity logs
CREATE POLICY "Anyone can view activity logs" 
ON activity_logs FOR SELECT 
USING (true);