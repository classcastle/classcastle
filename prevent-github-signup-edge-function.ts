// Supabase Edge Function: Prevent GitHub OAuth Signup
// Deploy this as an Edge Function to block GitHub OAuth signups
// This runs server-side and cannot be bypassed by client-side code
// Note: Supabase validates the webhook secret before sending requests here

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const { method } = req

    // Only handle POST requests
    if (method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const { event, user } = await req.json()

    // Only block new user creation events
    if (event !== 'user.created') {
      return new Response(JSON.stringify({ allowed: true }), { status: 200 })
    }

    // Check if this is a GitHub OAuth signup (no email initially)
    if (!user.email) {
      // Check if user has GitHub identity
      const hasGithubIdentity = user.identities?.some(
        (identity) => identity.provider === 'github'
      )

      if (hasGithubIdentity) {
        // Reject the signup
        return new Response(
          JSON.stringify({
            allowed: false,
            message: 'No Classcastle account found for this GitHub account. Please sign up at signup.html first, then link GitHub in Settings.'
          }),
          { status: 400 }
        )
      }
    }

    // Allow all other signups (email/password, etc.)
    return new Response(JSON.stringify({ allowed: true }), { status: 200 })
  } catch (error) {
    console.error('Error in prevent-github-signup function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
