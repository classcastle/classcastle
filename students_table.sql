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

-- Create points table for tracking student points
CREATE TABLE IF NOT EXISTS points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE points ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can insert points for their school's students
CREATE POLICY "Teachers can insert points"
  ON points FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = student_id
      AND raw_user_meta_data->>'school_name' = (
        SELECT raw_user_meta_data->>'school_name'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Teachers can view points for their school's students
CREATE POLICY "Teachers can view points"
  ON points FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = student_id
      AND raw_user_meta_data->>'school_name' = (
        SELECT raw_user_meta_data->>'school_name'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Students can view their own points
CREATE POLICY "Students can view own points"
  ON points FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can insert announcements for their school
CREATE POLICY "Teachers can insert announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND school_name = (
      SELECT raw_user_meta_data->>'school_name'
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Policy: Teachers can view their own announcements
CREATE POLICY "Teachers can view own announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

-- Policy: Students can view announcements for their school
CREATE POLICY "Students can view school announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    school_name = raw_user_meta_data->>'school_name'
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Create RPC function to get student points total
CREATE OR REPLACE FUNCTION public.get_student_points(p_student_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM points
  WHERE student_id = p_student_id;
$$;

-- Create RPC function to award points
CREATE OR REPLACE FUNCTION public.award_points(
  p_student_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  INSERT INTO points (student_id, teacher_id, amount, reason)
  VALUES (p_student_id, auth.uid(), p_amount, p_reason);

  v_result := json_build_object('success', true);
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object('success', false, 'error', SQLERRM);
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_student_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_points(UUID, INTEGER, TEXT) TO authenticated;
