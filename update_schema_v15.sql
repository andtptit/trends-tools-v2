-- Drop old constraint that restricts status values
ALTER TABLE public.trends DROP CONSTRAINT IF EXISTS trends_status_check;

-- Add updated check constraint to allow 'analyzed' status for intermediate batch trends
ALTER TABLE public.trends ADD CONSTRAINT trends_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'analyzed'));
