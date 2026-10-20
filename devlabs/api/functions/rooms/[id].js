/**
 * Get Room Details API Endpoint
 * GET /rooms/{id}
 */

export const onRequestGet = async (context) => {
  const { request, env, params } = context;

  try {
    // Get Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 4002,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const roomId = params.id;

    const supabaseUrl = env.SUPABASE_URL || 'https://hduyofdbpspjcuwvackd.supabase.co';
    const supabaseKey = env.SUPABASE_KEY || 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

    // Hash the API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Validate API key
    const keyCheckResponse = await fetch(`${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${hashHex}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const keyData = await keyCheckResponse.json();

    if (!keyData || keyData.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 4002,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = keyData[0].user_id;

    // Get room details
    const roomResponse = await fetch(`${supabaseUrl}/rest/v1/rooms?id=eq.${roomId}&teacher_id=eq.${userId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const roomData = await roomResponse.json();

    if (!roomData || roomData.length === 0) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 4003,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update last_used_at for API key
    await fetch(`${supabaseUrl}/rest/v1/api_keys?id=eq.${keyData[0].id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ last_used_at: new Date().toISOString() })
    });

    return new Response(JSON.stringify(roomData[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
