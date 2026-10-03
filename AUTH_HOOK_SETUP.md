# Supabase Auth Hook Setup Guide

## Before User Created Hook (Recommended)

### Step 1: Deploy the SQL Function
1. **Go to Supabase Dashboard** → Your Project
2. **SQL Editor** (in left sidebar)
3. **Paste the SQL** from `auth-hook-prevent-github-signup.sql`
4. **Click "Run"** to execute it
5. This creates the function and removes the old trigger

### Step 2: Enable the Hook in Dashboard
1. **Go to** Authentication → **Hooks** (in left sidebar)
2. **Click "Add Hook"**
3. **Hook Type**: Before User Created
4. **Hook Name**: `block_github_signup`
5. **Implementation**: Postgres Function
6. **Function**: `public.hook_block_github_signup`
7. **Click "Save"**

### Step 3: Test the Hook
- Try signing up with a new GitHub account → Should be rejected with error message
- Try signing up with email/password → Should work
- Try linking GitHub from Settings → Should work

## How It Works

- **Email/Password Signup**: Provider is `email`, so it's allowed
- **GitHub OAuth Signup**: Provider is `github`, so it's rejected with custom error message
- **linkIdentity**: Attaches identity to existing user, doesn't create new user, so hook never fires
- **Existing user signing in with GitHub**: No user is created, so it's allowed

## Important Notes

- The hook checks `event->'user'->'app_metadata'->>'provider'` to detect GitHub
- GitHub OAuth DOES provide an email (the old assumption was incorrect)
- The provider is stored in `raw_app_meta_data`, not `raw_user_meta_data`
- This approach uses Supabase's built-in Before User Created hook feature
- Error messages from this hook are properly passed back to the client
- The trigger approach doesn't work because it can't deliver custom error messages
