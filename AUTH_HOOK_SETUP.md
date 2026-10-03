# Supabase Auth Hook Setup Guide

## Dashboard Steps to Enable the Hook

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Go to **Authentication** → **Hooks** in the left sidebar

2. **Create "Before User Created" Hook**
   - Click **"Add Hook"**
   - Select **"Before User Created"** hook type
   - Name it: `prevent_github_signup`
   - For the hook type, select **"Postgres Function"**
   - Click **"Save"**

3. **Deploy the SQL Function**
   - Copy the SQL from `auth-hook-prevent-github-signup.sql`
   - Go to **SQL Editor** in the left sidebar
   - Paste the SQL and click **"Run"** to execute it
   - This creates the function and trigger

4. **Verify the Hook is Active**
   - In Authentication → Hooks, you should see `prevent_github_signup` listed
   - It should show as "Active"
   - The trigger will now run before any new user is created

## How It Works

- **Email/Password Signup**: Passes through (has email field filled)
- **GitHub OAuth Signup**: Blocked (no email initially, provider is github)
- **linkIdentity**: Not affected (adds identity to existing user, doesn't create new user)
- **Existing GitHub users**: Can still sign in (hook only runs on creation, not sign-in)

## Important Notes

- The hook uses `NEW.email IS NULL` to detect OAuth signups
- Email/password signups always have an email, so they pass
- GitHub OAuth initially creates users without email (supplied later), so they're blocked
- The error message will be returned to the client via URL parameters
