/**
 * Create Room API Endpoint
 * POST /api/v1/createroom
 */

export const onRequestPost = async (context) => {
  const { request, env } = context;

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

    // Validate API key against Supabase
    const supabaseUrl = env.SUPABASE_URL || 'https://hduyofdbpspjcuwvackd.supabase.co';
    const supabaseKey = env.SUPABASE_KEY || 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

    // Hash the API key to compare with stored hash
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if API key exists in Supabase
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

    // Get request body
    const body = await request.json();
    const { name, trycode } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Room name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate room code
    let roomCode;
    if (trycode) {
      // Check if code already exists
      const codeCheckResponse = await fetch(`${supabaseUrl}/rest/v1/rooms?code=eq.${trycode}&select=code`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const codeData = await codeCheckResponse.json();

      if (codeData && codeData.length > 0) {
        return new Response(JSON.stringify({ error: 'Room code already exists' }), {
          status: 4001,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      roomCode = trycode;
    } else {
      // Generate random 6-character code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      do {
        roomCode = '';
        for (let i = 0; i < 6; i++) {
          roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      } while (await codeExists(supabaseUrl, supabaseKey, roomCode));
    }

    // Create room in Supabase
    const createResponse = await fetch(`${supabaseUrl}/rest/v1/rooms`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        teacher_id: userId,
        code: roomCode,
        name: name,
        active: true,
        archived: false
      })
    });

    const roomData = await createResponse.json();

    if (!createResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to create room' }), {
        status: 500,
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

async function codeExists(supabaseUrl, supabaseKey, code) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rooms?code=eq.${code}&select=code`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await response.json();
  return data && data.length > 0;
}
