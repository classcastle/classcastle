-- Add school fields to existing polls table
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_postcode TEXT;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_lat DOUBLE PRECISION;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_lon DOUBLE PRECISION;
