/**
 * Stats API Endpoint
 * GET /stats
 * Public endpoint - no authentication required
 * Reads statistics from Supabase for persistent tracking
 */

async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
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

  try {
    // Fetch global stats
    const globalResponse = await fetch(`${supabaseUrl}/rest/v1/api_global_stats?id=eq.1&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const globalData = await globalResponse.json();

    if (!globalData || globalData.length === 0) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Stats not initialized' })
      };
    }

    const global = globalData[0];

    // Fetch endpoint stats
    const endpointResponse = await fetch(`${supabaseUrl}/rest/v1/api_stats?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const endpointData = await endpointResponse.json();

    // Fetch failures by reason
    const failuresResponse = await fetch(`${supabaseUrl}/rest/v1/api_failures?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const failuresData = await failuresResponse.json();

    // Calculate uptime
    const uptime = Date.now() - new Date(global.start_time).getTime();
    const uptimeSeconds = Math.floor(uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    const uptimeString = uptimeDays > 0
      ? `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`
      : uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMinutes % 60}m`
      : `${uptimeMinutes}m ${uptimeSeconds % 60}s`;

    // Calculate success rate
    const successRate = global.total_requests > 0
      ? ((global.successful_requests / global.total_requests) * 100).toFixed(2) + '%'
      : '0%';

    // Format endpoint stats
    const endpointStats = endpointData.map(ep => ({
      endpoint: ep.endpoint,
      hits: ep.hits,
      failures: ep.failures,
      successRate: ep.hits > 0 ? ((ep.hits - ep.failures) / ep.hits * 100).toFixed(2) + '%' : '0%'
    }));

    // Format failures by reason
    const failuresByReason = {};
    failuresData.forEach(f => {
      failuresByReason[f.reason] = f.count;
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        uptime: uptimeString,
        uptimeMs: uptime,
        totalRequests: global.total_requests,
        successfulRequests: global.successful_requests,
        failedRequests: global.failed_requests,
        successRate: successRate,
        failuresByReason: failuresByReason,
        endpoints: endpointStats
      })
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

module.exports.handler = handler;

