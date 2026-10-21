/**
 * Navigate Room API Endpoint
 * POST /rooms/{id}/navigate
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
      stats.endpoints.navigate.failures++;
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
      stats.endpoints.navigate.failures++;
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

    // Get request body
    const body = JSON.parse(event.body);
    const { url } = body;

    if (!url) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      const { stats } = require('./stats.js');
      stats.totalRequests++;
      stats.failedRequests++;
      stats.endpoints.navigate.failures++;
      stats.failuresByReason['Invalid URL'] = (stats.failuresByReason['Invalid URL'] || 0) + 1;

      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid URL' })
      };
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
      const { stats } = require('./stats.js');
      stats.totalRequests++;
      stats.failedRequests++;
      stats.endpoints.navigate.failures++;
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
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Failed to update room' })
      };
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

    // Record stats
    const stats = require('./stats.js').stats;
    stats.totalRequests++;
    stats.successfulRequests++;
    stats.endpoints.navigate.hits++;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        url: url,
        students_notified: studentCount
      })
    };

  } catch (error) {
    // Record stats
    const stats = require('./stats.js').stats;
    stats.totalRequests++;
    stats.failedRequests++;
    stats.endpoints.navigate.failures++;
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
