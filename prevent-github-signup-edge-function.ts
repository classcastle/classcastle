// Supabase Edge Function: Prevent GitHub OAuth Signup
// Deploy this as an Edge Function to block GitHub OAuth signups
// This runs server-side and cannot be bypassed by client-side code

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Verify Supabase webhook signature using Web Crypto API
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false

  const [version, ...signatureParts] = signature.split(',')
  if (version !== 'v1') return false

  const receivedSignature = signatureParts.join(',')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  )

  const expectedSignatureBase64 = btoa(
    String.fromCharCode(...new Uint8Array(expectedSignature))
  )

  return receivedSignature === expectedSignatureBase64
}

serve(async (req) => {
  try {
    const { method } = req

    // Only handle POST requests
    if (method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Get the signature from headers
    const signature = req.headers.get('sb-signature')
    const secret = Deno.env.get('SB_WEBHOOK_SECRET')

    // Read the body
    const body = await req.text()
    const payload = body

    // Verify signature if both are present
    if (signature && secret) {
      const isValid = await verifySignature(payload, signature, secret)
      if (!isValid) {
        console.error('Invalid signature')
        return new Response('Invalid signature', { status: 401 })
      }
    }

    const { event, user } = JSON.parse(payload)

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
