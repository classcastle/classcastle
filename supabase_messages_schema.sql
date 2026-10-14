-- Create message_threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create thread_messages table
CREATE TABLE IF NOT EXISTS thread_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_type TEXT DEFAULT 'teacher', -- 'teacher' or 'student'
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_threads_teacher_id ON message_threads(teacher_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_created_at ON message_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id ON thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at ON thread_messages(created_at ASC);

-- Enable Row Level Security
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_threads
-- Teachers can view their own threads
CREATE POLICY "Teachers can view own threads"
  ON message_threads FOR SELECT
  USING (auth.uid() = teacher_id);

-- Teachers can create threads
CREATE POLICY "Teachers can create threads"
  ON message_threads FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

-- Teachers can update their own threads
CREATE POLICY "Teachers can update own threads"
  ON message_threads FOR UPDATE
  USING (auth.uid() = teacher_id);

-- Teachers can delete their own threads
CREATE POLICY "Teachers can delete own threads"
  ON message_threads FOR DELETE
  USING (auth.uid() = teacher_id);

-- RLS Policies for thread_messages
-- Users can view messages in threads they have access to
CREATE POLICY "Users can view thread messages"
  ON thread_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM message_threads
      WHERE message_threads.id = thread_messages.thread_id
      AND message_threads.teacher_id = auth.uid()
    )
  );

-- Teachers can create messages in their own threads
CREATE POLICY "Teachers can create messages in own threads"
  ON thread_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM message_threads
      WHERE message_threads.id = thread_messages.thread_id
      AND message_threads.teacher_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on message_threads
CREATE TRIGGER update_message_threads_updated_at
  BEFORE UPDATE ON message_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update room target_url when a thread with URL is created
CREATE OR REPLACE FUNCTION update_room_target_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_url IS NOT NULL THEN
    -- Update the teacher's active room with the target URL
    UPDATE rooms
    SET target_url = NEW.target_url,
        updated_at = NOW()
    WHERE teacher_id = NEW.teacher_id
    AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call update_room_target_url when a thread is created
CREATE TRIGGER update_room_url_on_thread_create
  AFTER INSERT ON message_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_room_target_url();
