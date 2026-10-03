-- Supabase Auth Hook: Prevent GitHub OAuth from creating new users
-- This function runs BEFORE a user is created in auth.users
-- It will reject GitHub OAuth signups (which create new users)
-- while allowing email/password signups and linkIdentity operations

-- Step 1: Create the function
CREATE OR REPLACE FUNCTION auth.prevent_github_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only block GitHub OAuth signups (which create new users)
  -- linkIdentity adds an identity to existing users and doesn't trigger this hook
  IF NEW.email IS NULL THEN
    -- This is likely an OAuth signup (email/password always has email)
    -- Check if provider is github
    IF (SELECT provider FROM auth.identities WHERE user_id = NEW.id LIMIT 1) = 'github' THEN
      -- Reject the signup
      RAISE EXCEPTION 'No Classcastle account found for this GitHub account. Please sign up at signup.html first, then link GitHub in Settings.'
        USING ERRCODE = 'auth_github_signup_not_allowed';
    END IF;
  END IF;

  -- Allow all other signups (email/password, etc.)
  RETURN NEW;
END;
$$;

-- Step 2: Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.prevent_github_signup();

-- Step 3: Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.prevent_github_signup() TO service_role;
GRANT EXECUTE ON FUNCTION auth.prevent_github_signup() TO postgres;
