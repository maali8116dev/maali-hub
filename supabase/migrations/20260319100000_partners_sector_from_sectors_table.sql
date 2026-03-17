-- Allow partners.sector to be any value from sectors table (drop fixed-list CHECK)
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_Sector_check;
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_sector_check;
