-- Drop existing table if it exists
DROP TABLE IF EXISTS students CASCADE;

-- Create teacher_schools table to securely track school assignments
CREATE TABLE IF NOT EXISTS teacher_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  school_postcode TEXT,
  school_lat FLOAT,
  school_lon FLOAT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id)
);

-- Enable RLS
ALTER TABLE teacher_schools ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can only view their own school assignment
CREATE POLICY "Teachers can view own school"
  ON teacher_schools FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

-- Policy: Block updates to teacher_schools
CREATE POLICY "Block updates to teacher_schools"
  ON teacher_schools FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Policy: Block inserts from authenticated users (only service role can insert)
CREATE POLICY "Block inserts to teacher_schools"
  ON teacher_schools FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Create RPC function to get students from auth.users by school
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

-- Create RPC function to get teacher's school assignment
CREATE OR REPLACE FUNCTION public.get_teacher_school()
RETURNS TABLE (
  school_name TEXT,
  school_postcode TEXT,
  school_lat FLOAT,
  school_lon FLOAT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_name, school_postcode, school_lat, school_lon
  FROM teacher_schools
  WHERE teacher_id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_school_students(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_school() TO authenticated;

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

-- Policy: Teachers can insert points (validated by RPC)
CREATE POLICY "Teachers can insert points"
  ON points FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- Policy: Teachers can view points they awarded
CREATE POLICY "Teachers can view own points"
  ON points FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

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

-- Policy: Teachers can insert announcements (validated by RPC)
CREATE POLICY "Teachers can insert announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- Policy: Teachers can view their own announcements
CREATE POLICY "Teachers can view own announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

-- Policy: Students can view announcements (validated by RPC)
CREATE POLICY "Students can view announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (true);

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

-- Create RPC function to award points with school validation
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
  v_teacher_school TEXT;
  v_student_school TEXT;
  v_result JSON;
BEGIN
  -- Get teacher's school from secure table
  SELECT school_name INTO v_teacher_school
  FROM teacher_schools
  WHERE teacher_id = auth.uid();

  IF v_teacher_school IS NULL THEN
    v_result := json_build_object('success', false, 'error', 'No school assigned to teacher');
    RETURN v_result;
  END IF;

  -- Get student's school from auth.users
  SELECT raw_user_meta_data->>'school_name' INTO v_student_school
  FROM auth.users
  WHERE id = p_student_id;

  IF v_student_school IS NULL THEN
    v_result := json_build_object('success', false, 'error', 'Student has no school assigned');
    RETURN v_result;
  END IF;

  -- Validate schools match
  IF v_teacher_school != v_student_school THEN
    v_result := json_build_object('success', false, 'error', 'Cannot award points to student from different school');
    RETURN v_result;
  END IF;

  -- Award points
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

-- Create RPC function to create announcement with school validation
CREATE OR REPLACE FUNCTION public.create_announcement(
  p_title TEXT,
  p_message TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_school TEXT;
  v_result JSON;
BEGIN
  -- Get teacher's school from secure table
  SELECT school_name INTO v_teacher_school
  FROM teacher_schools
  WHERE teacher_id = auth.uid();

  IF v_teacher_school IS NULL THEN
    v_result := json_build_object('success', false, 'error', 'No school assigned to teacher');
    RETURN v_result;
  END IF;

  -- Create announcement
  INSERT INTO announcements (teacher_id, school_name, title, message, expires_at)
  VALUES (auth.uid(), v_teacher_school, p_title, p_message, p_expires_at);

  v_result := json_build_object('success', true);
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object('success', false, 'error', SQLERRM);
  RETURN v_result;
END;
$$;

-- Create RPC function to get announcements for a student
CREATE OR REPLACE FUNCTION public.get_student_announcements()
RETURNS TABLE (
  id UUID,
  title TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, message, created_at
  FROM announcements
  WHERE school_name = (
    SELECT raw_user_meta_data->>'school_name'
    FROM auth.users
    WHERE id = auth.uid()
  )
  AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_student_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_points(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_announcement(TEXT, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_announcements() TO authenticated;
