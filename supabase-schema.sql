-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES auth.users NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  target_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_url TEXT,
  online BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create url_history table
CREATE TABLE IF NOT EXISTS url_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  pushed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rooms_teacher_id ON rooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(active);
CREATE INDEX IF NOT EXISTS idx_students_room_id ON students(room_id);
CREATE INDEX IF NOT EXISTS idx_students_online ON students(online);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_url_history_room_id ON url_history(room_id);
CREATE INDEX IF NOT EXISTS idx_url_history_pushed_at ON url_history(pushed_at);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for rooms
DROP POLICY IF EXISTS "Teachers can view their own rooms" ON rooms;
CREATE POLICY "Teachers can view their own rooms"
  ON rooms FOR SELECT
  USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Anyone can view active rooms" ON rooms;
CREATE POLICY "Anyone can view active rooms"
  ON rooms FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Teachers can create rooms" ON rooms;
CREATE POLICY "Teachers can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can update their own rooms" ON rooms;
CREATE POLICY "Teachers can update their own rooms"
  ON rooms FOR UPDATE
  USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own rooms" ON rooms;
CREATE POLICY "Teachers can delete their own rooms"
  ON rooms FOR DELETE
  USING (auth.uid() = teacher_id);

-- Realtime publication for rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;
END $$;

-- Realtime publication for students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE students;
  END IF;
END $$;

-- RLS policies for students
DROP POLICY IF EXISTS "Teachers can view students in their rooms" ON students;
CREATE POLICY "Teachers can view students in their rooms"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = students.room_id
      AND rooms.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view students in active rooms" ON students;
CREATE POLICY "Anyone can view students in active rooms"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = students.room_id
      AND rooms.active = true
    )
  );

DROP POLICY IF EXISTS "Anyone can insert students in active rooms" ON students;
CREATE POLICY "Anyone can insert students in active rooms"
  ON students FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = students.room_id
      AND rooms.active = true
    )
  );

DROP POLICY IF EXISTS "Teachers can insert students in their rooms" ON students;
CREATE POLICY "Teachers can insert students in their rooms"
  ON students FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = students.room_id
      AND rooms.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can update students in their rooms" ON students;
CREATE POLICY "Teachers can update students in their rooms"
  ON students FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = students.room_id
      AND rooms.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can delete students in their rooms" ON students;
CREATE POLICY "Teachers can delete students in their rooms"
  ON students FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = students.room_id
      AND rooms.teacher_id = auth.uid()
    )
  );

-- RLS policies for url_history
DROP POLICY IF EXISTS "Teachers can view url history in their rooms" ON url_history;
CREATE POLICY "Teachers can view url history in their rooms"
  ON url_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = url_history.room_id
      AND rooms.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can insert url history in their rooms" ON url_history;
CREATE POLICY "Teachers can insert url history in their rooms"
  ON url_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = url_history.room_id
      AND rooms.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can delete url history in their rooms" ON url_history;
CREATE POLICY "Teachers can delete url history in their rooms"
  ON url_history FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = url_history.room_id
      AND rooms.teacher_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for rooms table
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_seen timestamp
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for students table
DROP TRIGGER IF EXISTS update_students_last_seen ON students;
CREATE TRIGGER update_students_last_seen
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_last_seen();
