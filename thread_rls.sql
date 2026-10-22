-- Drop NOT NULL constraint from sender_id (students have no auth user)
alter table thread_messages alter column sender_id drop not null;

-- Function to get shared thread data (for students)
create or replace function public.get_shared_thread(p_thread_id uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'thread', (select row_to_json(t) from (select id, title, message, target_url, created_at
               from message_threads where id = p_thread_id and coalesce(is_personal,false) = false) t),
    'messages', coalesce((select json_agg(m order by m.created_at)
               from (select id, sender_name, sender_type, message, created_at
                     from thread_messages where thread_id = p_thread_id) m), '[]'::json));
$$;

-- Function for students to post replies
create or replace function public.post_student_reply(p_thread_id uuid, p_name text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_message,''))) = 0 or length(p_message) > 1000 then raise exception 'invalid message'; end if;
  if not exists (select 1 from message_threads where id = p_thread_id and coalesce(is_personal,false) = false)
    then raise exception 'thread not found'; end if;
  insert into thread_messages (thread_id, sender_name, sender_type, message, created_at)
  values (p_thread_id, left(trim(coalesce(nullif(p_name,''),'Student')), 50), 'student', trim(p_message), now());
end $$;

-- Grant execute to anon role (students)
grant execute on function public.get_shared_thread(uuid) to anon;
grant execute on function public.post_student_reply(uuid,text,text) to anon;

-- RLS policies for threads (adjust column names as needed)
-- Allow teachers to SELECT their own threads
create policy "Teachers can select own message_threads"
  on message_threads for select
  to authenticated
  using (teacher_id = auth.uid());

-- Allow teachers to SELECT thread_messages for their own threads
create policy "Teachers can select thread_messages for their threads"
  on thread_messages for select
  to authenticated
  using (exists (
    select 1 from message_threads t
    where t.id = thread_messages.thread_id and t.teacher_id = auth.uid()
  ));

-- Allow teachers to UPDATE their own rooms
create policy "Teachers can update own rooms"
  on rooms for update
  to authenticated
  using (teacher_id = auth.uid());

-- Allow anon (students) to read message_threads and thread_messages
create policy "Allow anon to read message_threads"
  on message_threads for select
  to anon
  using (coalesce(is_personal,false) = false);

create policy "Allow anon to read thread_messages"
  on thread_messages for select
  to anon
  using (true);

-- Allow anon to insert thread_messages (replies)
create policy "Allow anon to insert thread_messages"
  on thread_messages for insert
  to anon
  with check (true);
