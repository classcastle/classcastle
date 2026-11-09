/**
 * Register an OAuth client with Supabase OAuth Server.
 * POST /registeroauthapp
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === 'authorization')?.[1];

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return response(500, { error: 'Server configuration error' });
  }

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return response(401, { error: 'Authentication required' });
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      Authorization: authorization
    }
  });

  if (!userResponse.ok) {
    return response(401, { error: 'Your Classcastle session is no longer valid. Please log in again.' });
  }

  let request;
  try {
    request = JSON.parse(event.body || '{}');
  } catch (error) {
    return response(400, { error: 'Invalid request body' });
  }

  const name = typeof request.name === 'string' ? request.name.trim() : '';
  const redirectUri = typeof request.redirectUri === 'string' ? request.redirectUri.trim() : '';
  const scopes = Array.isArray(request.scopes)
    ? request.scopes.filter(scope => typeof scope === 'string' && /^[a-z][a-z0-9._:-]*$/.test(scope))
    : [];

  if (!name || name.length > 100) {
    return response(400, { error: 'App name is required and must be 100 characters or fewer.' });
  }

  let parsedRedirect;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch (error) {
    return response(400, { error: 'Enter a valid redirect URL.' });
  }

  if (parsedRedirect.protocol !== 'https:' && parsedRedirect.hostname !== 'localhost') {
    return response(400, { error: 'Production redirect URLs must use HTTPS.' });
  }

  if (scopes.length === 0) {
    return response(400, { error: 'Select at least one OAuth scope.' });
  }

  const registrationResponse = await fetch(`${supabaseUrl}/auth/v1/admin/oauth/clients`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      redirect_uris: [redirectUri],
      client_type: 'confidential',
      token_endpoint_auth_method: 'client_secret_basic'
    })
  });

  const registrationBody = await registrationResponse.json().catch(() => ({}));
  if (!registrationResponse.ok) {
    return response(registrationResponse.status, {
      error: registrationBody.msg || registrationBody.message || registrationBody.error || 'Could not register the OAuth app.'
    });
  }

  return response(201, {
    client_id: registrationBody.client_id,
    client_secret: registrationBody.client_secret,
    name: registrationBody.name || name,
    redirect_uris: registrationBody.redirect_uris || [redirectUri],
    scopes
  });
}
