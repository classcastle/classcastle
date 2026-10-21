/**
 * List Rooms API Endpoint
 * GET /rooms
 */

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: 'Method not allowed'
    };
  }

  try {
    // Get Authorization header - convert headers object to standard format
    const headers = {};
    for (const key in event.headers) {
      headers[key.toLowerCase()] = event.headers[key];
    }
    const authHeader = headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing or invalid Authorization header' })
      };
    }

    const apiKey = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Hash the API key
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Validate API key
    const keyCheckResponse = await fetch(`${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${hash}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const keyData = await keyCheckResponse.json();

    if (!keyData || keyData.length === 0) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid API key', code: 4002 })
      };
    }

    const userId = keyData[0].user_id;

    // Get all rooms for the user
    const roomsResponse = await fetch(`${supabaseUrl}/rest/v1/rooms?teacher_id=eq.${userId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const roomsData = await roomsResponse.json();

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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(roomsData)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
}
