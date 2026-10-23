-- Drop existing table if it exists
DROP TABLE IF EXISTS students CASCADE;

-- Create RPC function to get students from auth.users by school
-- This is more secure than a separate table and avoids data leaks
CREATE OR REPLACE FUNCTION public.get_school_students(p_school_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  school_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    COALESCE(raw_user_meta_data->>'name', email) as name,
    email,
    raw_user_meta_data->>'school_name' as school_name,
    created_at
  FROM auth.users
  WHERE raw_user_meta_data->>'user_type' = 'student'
    AND raw_user_meta_data->>'school_name' = p_school_name
    AND raw_user_meta_data->>'school_name' IS NOT NULL;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_school_students(TEXT) TO authenticated;
