/**
 * Create Room API Endpoint
 * POST /createroom
 */

// Simple in-memory rate limiter (per API key, per minute)
const rateLimitMap = new Map();
const RATE_LIMIT = 60; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

function checkRateLimit(apiKey) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Get or create rate limit entry for this API key
  let entry = rateLimitMap.get(apiKey);
  if (!entry) {
    entry = { requests: [], count: 0 };
    rateLimitMap.set(apiKey, entry);
  }

  // Clean up old requests outside the window
  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
  entry.count = entry.requests.length;

  // Check if over limit
  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  // Add current request
  entry.requests.push(now);
  return true;
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
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

    // Validate API key against Supabase
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

    // Hash the API key to compare with stored hash
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // Check if API key exists in Supabase
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
        body: JSON.stringify({ error: 'Invalid API key' })
      };
    }

    const userId = keyData[0].user_id;

    // Check rate limit
    if (!checkRateLimit(apiKey)) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Too many requests' })
      };
    }

    // Get request body
    const body = JSON.parse(event.body);
    const { name, trycode } = body;

    if (!name) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Room name is required' })
      };
    }

    // Generate room code
    let roomCode;
    if (trycode) {
      // Validate that trycode is exactly 6 characters and only numbers
      if (trycode.length !== 6) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Room code must be exactly 6 digits' })
        };
      }

      if (!/^\d{6}$/.test(trycode)) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Room code must contain only numbers' })
        };
      }

      // Check if code already exists
      const codeCheckResponse = await fetch(`${supabaseUrl}/rest/v1/rooms?code=eq.${trycode}&select=code`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const codeData = await codeCheckResponse.json();

      if (codeData && codeData.length > 0) {
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Room code already exists' })
        };
      }

      roomCode = trycode;
    } else {
      // Generate random 6-digit code
      do {
        roomCode = '';
        for (let i = 0; i < 6; i++) {
          roomCode += Math.floor(Math.random() * 10);
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
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Failed to create room' })
      };
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(roomData[0])
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
