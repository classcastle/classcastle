# Testing Guide for GitHub OAuth Prevention

## Test Cases

### Test 1: Existing User Logs In with GitHub (Should Work)
1. **Setup**: Create a test account via signup.html with email/password
2. **Link GitHub**: Go to Settings in app.html, click "Link GitHub Account", complete OAuth
3. **Sign Out**: Log out of the account
4. **Test**: Go to login.html, click "Continue with GitHub"
5. **Expected**: User is signed in and redirected to app.html
6. **Verify**: User can access their dashboard and rooms

### Test 2: Brand-New GitHub User is Rejected (Should Block)
1. **Setup**: Use a GitHub account that has never been used with Classcastle
2. **Test**: Go to login.html, click "Continue with GitHub"
3. **Expected**: OAuth redirect happens, then user is redirected back to login.html with error
4. **Verify**: Modal shows: "No Classcastle Account Found - No Classcastle account found for this GitHub account. Please sign up at signup.html first, then link GitHub in Settings."
5. **Verify in Database**: Check auth.users table - NO new user row should be created for this GitHub account
   ```sql
   SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;
   ```

### Test 3: Email Signup Still Works (Should Work)
1. **Test**: Go to signup.html, fill in name and email, create password
2. **Expected**: Account created successfully, user redirected to app.html
3. **Verify**: User can log in with email/password on login.html
4. **Verify**: New user row exists in auth.users with email filled

### Test 4: Linking GitHub from Settings Still Works (Should Work)
1. **Setup**: Create account via signup.html with email/password
2. **Test**: Go to Settings in app.html, click "Link GitHub Account"
3. **Expected**: OAuth flow completes, GitHub identity is linked to existing user
4. **Verify**: In Settings, GitHub account appears in "Linked Accounts" section
5. **Verify**: User can now sign in with GitHub on login.html (see Test 1)

### Test 5: Attempting to Link GitHub Without Email Account (Should Not Work)
1. **Note**: This is already handled by the app requiring login first
2. **Test**: Try to access Settings without being logged in (redirects to login)
3. **Expected**: Cannot access Settings without existing account

## Database Verification Queries

### Check for GitHub-only users (should be none after implementation):
```sql
SELECT id, email, created_at
FROM auth.users
WHERE email IS NULL
ORDER BY created_at DESC;
```

### Check for users with GitHub identities:
```sql
SELECT u.id, u.email, i.provider, i.created_at
FROM auth.users u
JOIN auth.identities i ON u.id = i.user_id
WHERE i.provider = 'github'
ORDER BY u.created_at DESC;
```

### Check auth.users table for recent creations:
```sql
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

## Browser Testing Tips

1. **Use Incognito/Private Mode**: Prevents cached sessions from interfering
2. **Clear Cookies/Local Storage**: Between tests, clear browser data to ensure clean state
3. **Check Network Tab**: In browser DevTools, monitor the OAuth redirect to see error parameters
4. **Monitor Console**: Check for any JavaScript errors during the flow

## Edge Cases to Consider

- **GitHub account already linked to different email**: Should show "identity_not_found" error
- **User deleted but tries GitHub login**: Should show "user_not_found" error
- **User banned tries GitHub login**: Should show "user_banned" error
- **Supabase hook disabled**: Test that email signup still works if hook is accidentally disabled
