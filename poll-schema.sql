-- Quick Polls Feature
-- Allows teachers to create polls and share URLs for students to respond

-- Polls table
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_id TEXT UNIQUE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of option strings
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll responses table
CREATE TABLE IF NOT EXISTS public.poll_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_polls_teacher_id ON public.polls(teacher_id);
CREATE INDEX IF NOT EXISTS idx_polls_custom_id ON public.polls(custom_id);
CREATE INDEX IF NOT EXISTS idx_polls_active ON public.polls(active);
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_id ON public.poll_responses(poll_id);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

-- Policies for polls
CREATE POLICY "Teachers can view their own polls"
  ON public.polls FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create polls"
  ON public.polls FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own polls"
  ON public.polls FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own polls"
  ON public.polls FOR DELETE
  USING (teacher_id = auth.uid());

CREATE POLICY "Anyone can view active polls by custom_id"
  ON public.polls FOR SELECT
  USING (active = true);

-- Policies for poll responses
CREATE POLICY "Teachers can view responses to their polls"
  ON public.poll_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.polls
      WHERE polls.id = poll_responses.poll_id
      AND polls.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can submit responses to active polls"
  ON public.poll_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls
      WHERE polls.id = poll_responses.poll_id
      AND polls.active = true
    )
  );

CREATE POLICY "Teachers can delete responses to their polls"
  ON public.poll_responses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.polls
      WHERE polls.id = poll_responses.poll_id
      AND polls.teacher_id = auth.uid()
    )
  );
