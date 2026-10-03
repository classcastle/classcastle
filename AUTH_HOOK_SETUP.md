# Supabase Auth Hook Setup Guide

## Recommended: SQL Hook (No Authentication Issues)

### Step 1: Go to Supabase Dashboard SQL Editor
1. **Go to Supabase Dashboard** → Your Project
2. **SQL Editor** (in left sidebar)
3. **Paste the SQL** from `auth-hook-prevent-github-signup.sql`
4. **Click "Run"** to execute it
5. This creates the function and trigger in one step

### Step 2: Verify the Hook is Active
1. **Go to** Authentication → **Hooks** (in left sidebar)
2. You should see `on_auth_user_created` trigger listed
3. It should show as "Active"
4. The trigger will now run before any new user is created

### Step 3: Test the Hook
- Try signing up with a new GitHub account → Should be rejected
- Try signing up with email/password → Should work
- Try linking GitHub from Settings → Should work

## Alternative: HTTP Edge Function (Has Authentication Issues)

The Edge Function approach has 401 authentication issues with Supabase's webhook system. The SQL hook is recommended as it:
- Runs directly in the database (no external HTTP calls)
- Has no authentication issues
- Is simpler to deploy (just run SQL in Dashboard)
- More reliable and faster

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
- SQL hook runs directly in the database with proper permissions
- No need to manage secrets or authentication
