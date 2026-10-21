/**
 * Get Room Details API Endpoint
 * GET /rooms/{id}
 */

// Simple in-memory rate limiter (per API key, per minute)
const rateLimitMap = new Map();
const RATE_LIMIT = 60; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

function checkRateLimit(apiKey) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  let entry = rateLimitMap.get(apiKey);
  if (!entry) {
    entry = { requests: [], count: 0 };
    rateLimitMap.set(apiKey, entry);
  }

  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
  entry.count = entry.requests.length;

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

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
    const roomId = event.pathParameters.id;

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
      const { stats } = require('./stats.js');
      stats.totalRequests++;
      stats.failedRequests++;
      stats.endpoints.roomdetails.failures++;
      stats.failuresByReason['Invalid API key'] = (stats.failuresByReason['Invalid API key'] || 0) + 1;

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
      const { stats } = require('./stats.js');
      stats.totalRequests++;
      stats.failedRequests++;
      stats.endpoints.roomdetails.failures++;
      stats.failuresByReason['Rate limit exceeded'] = (stats.failuresByReason['Rate limit exceeded'] || 0) + 1;

      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Too many requests' })
      };
    }

    // Get room details
    const roomResponse = await fetch(`${supabaseUrl}/rest/v1/rooms?id=eq.${roomId}&teacher_id=eq.${userId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const roomData = await roomResponse.json();

    if (!roomData || roomData.length === 0) {
      const { stats } = require('./stats.js');
      stats.totalRequests++;
      stats.failedRequests++;
      stats.endpoints.roomdetails.failures++;
      stats.failuresByReason['Room not found'] = (stats.failuresByReason['Room not found'] || 0) + 1;

      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Room not found' })
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

    // Record stats
    const stats = require('./stats.js').stats;
    stats.totalRequests++;
    stats.successfulRequests++;
    stats.endpoints.roomdetails.hits++;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(roomData[0])
    };

  } catch (error) {
    // Record stats
    const stats = require('./stats.js').stats;
    stats.totalRequests++;
    stats.failedRequests++;
    stats.endpoints.roomdetails.failures++;
    stats.failuresByReason[error.message] = (stats.failuresByReason[error.message] || 0) + 1;

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
