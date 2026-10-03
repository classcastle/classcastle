-- Remove the broken trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.prevent_github_signup();

-- Before User Created hook: reject OAuth (GitHub) signups
CREATE OR REPLACE FUNCTION public.hook_block_github_signup(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  provider text;
BEGIN
  provider := event->'user'->'app_metadata'->>'provider';

  IF provider = 'github' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'No Classcastle account found for this GitHub account. Please sign up with email first, then link GitHub in Settings.'
      )
    );
  END IF;

  RETURN '{}'::jsonb;  -- allow everything else (email/password, etc.)
END;
$$;

-- Only the auth service should be able to run it
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_block_github_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_block_github_signup(jsonb) FROM authenticated, anon, public;
