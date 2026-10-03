-- Add school fields to existing polls table
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_postcode TEXT;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_lat DOUBLE PRECISION;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS school_lon DOUBLE PRECISION;

-- Note: This migration adds the school fields required for the new school selector feature
-- Run this in Supabase SQL Editor to update your existing polls table
