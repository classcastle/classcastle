-- Drop existing table if it exists (to recreate with correct schema)
DROP TABLE IF EXISTS students CASCADE;

-- Create students table for student management
CREATE TABLE students (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  school_name TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can only see students from their own school
CREATE POLICY "Teachers can view their students"
  ON students FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND user_metadata->>'school_name' = students.school_name
    )
  );

-- Policy: Teachers can insert students for their school
CREATE POLICY "Teachers can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND user_metadata->>'school_name' = students.school_name
    )
  );

-- Policy: Teachers can delete their students
CREATE POLICY "Teachers can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (
    teacher_id = auth.uid()
  );
