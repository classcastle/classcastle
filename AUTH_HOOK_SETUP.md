# Supabase Auth Hook Setup Guide

## Option 1: HTTP Edge Function (Recommended)

### Step 1: Deploy the Edge Function
1. **Go to Supabase Dashboard** → **Edge Functions** (left sidebar)
2. **Click "New Edge Function"**
3. **Name**: `prevent-github-signup`
4. **Paste the code** from `prevent-github-signup-edge-function.ts`
5. **Click "Deploy"**
6. **Copy the Function URL** (e.g., `https://hduyofdbpspjcuwvackd.supabase.co/functions/v1/prevent-github-signup`)

### Step 2: Configure the Auth Hook
1. **Go to** Authentication → **Hooks** → **Add Hook**
2. **Hook Type**: Before User Created
3. **Hook Name**: `prevent-github-signup`
4. **URL**: Paste the Edge Function URL
5. **Secret**: Click "Generate secret" - it will auto-generate `v1,whsec_...`
6. **Click "Save"**

**Note**: The Edge Function does not need to verify the signature - Supabase validates the secret before sending requests to the function. This is handled by Supabase's infrastructure.

### Step 3: Test the Hook
- Try signing up with a new GitHub account → Should be rejected
- Try signing up with email/password → Should work

## Option 2: SQL Hook (If you have Dashboard SQL Editor access)

### Step 1: Go to Supabase Dashboard
   - Navigate to your project
   - Go to **Authentication** → **Hooks** in the left sidebar

### Step 2: Create "Before User Created" Hook
   - Click **"Add Hook"**
   - Select **"Before User Created"** hook type
   - Name it: `prevent_github_signup`
   - For the hook type, select **"Postgres Function"**
   - Click **"Save"**

### Step 3: Deploy the SQL Function
   - Copy the SQL from `auth-hook-prevent-github-signup.sql`
   - Go to **SQL Editor** in the left sidebar
   - Paste the SQL and click **"Run"** to execute it
   - This creates the function and trigger

### Step 4: Verify the Hook is Active
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
- Edge Function approach does not require environment variables (Supabase handles secret validation)
