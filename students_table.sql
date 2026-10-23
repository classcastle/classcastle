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

-- Create RPC function to create a student account without signing in
-- This uses service role auth via RPC to avoid signing in as the student
CREATE OR REPLACE FUNCTION public.create_student_account(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_school_name TEXT,
  p_school_postcode TEXT,
  p_school_lat FLOAT,
  p_school_lon FLOAT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Create the user
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  VALUES (
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object(
      'name', p_name,
      'user_type', 'student',
      'school_name', p_school_name,
      'school_postcode', p_school_postcode,
      'school_lat', p_school_lat,
      'school_lon', p_school_lon
    )
  )
  RETURNING id INTO v_user_id;

  v_result := json_build_object('success', true, 'user_id', v_user_id);
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object('success', false, 'error', SQLERRM);
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_school_students(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_account(TEXT, TEXT, TEXT, TEXT, TEXT, FLOAT, FLOAT) TO authenticated;
