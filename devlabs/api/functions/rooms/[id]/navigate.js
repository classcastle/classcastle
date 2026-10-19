/**
 * Navigate Room API Endpoint
 * POST /api/v1/rooms/{id}/navigate
 */

export const onRequestPost = async (context) => {
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

    // Get request body
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 4004,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if room exists and belongs to user
    const roomCheckResponse = await fetch(`${supabaseUrl}/rest/v1/rooms?id=eq.${roomId}&teacher_id=eq.${userId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const roomData = await roomCheckResponse.json();

    if (!roomData || roomData.length === 0) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 4003,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update room target_url
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/rooms?id=eq.${roomId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target_url: url })
    });

    if (!updateResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to update room' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add to URL history
    await fetch(`${supabaseUrl}/rest/v1/url_history`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        room_id: roomId,
        url: url
      })
    });

    // Count online students
    const studentsResponse = await fetch(`${supabaseUrl}/rest/v1/students?room_id=eq.${roomId}&online=eq.true&select=id`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const studentsData = await studentsResponse.json();
    const studentCount = studentsData ? studentsData.length : 0;

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

    return new Response(JSON.stringify({
      success: true,
      url: url,
      students_notified: studentCount
    }), {
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
