/**
 * Stats API Endpoint
 * GET /stats
 * Public endpoint - no authentication required
 */

// Simple in-memory stats tracking
const stats = {
  startTime: Date.now(),
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  failuresByReason: {},
  endpoints: {
    createroom: { hits: 0, failures: 0 },
    rooms: { hits: 0, failures: 0 },
    roomdetails: { hits: 0, failures: 0 },
    navigate: { hits: 0, failures: 0 },
    activity: { hits: 0, failures: 0 },
    students: { hits: 0, failures: 0 },
    deleteroom: { hits: 0, failures: 0 }
  }
};

// Export stats object for other functions to access
module.exports = { stats };

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

  try {
    const uptime = Date.now() - stats.startTime;
    const uptimeSeconds = Math.floor(uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    const uptimeString = uptimeDays > 0 
      ? `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`
      : uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMinutes % 60}m`
      : `${uptimeMinutes}m ${uptimeSeconds % 60}s`;

    const successRate = stats.totalRequests > 0 
      ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%'
      : '0%';

    const endpointStats = Object.entries(stats.endpoints).map(([name, data]) => ({
      endpoint: name,
      hits: data.hits,
      failures: data.failures,
      successRate: data.hits > 0 ? ((data.hits - data.failures) / data.hits * 100).toFixed(2) + '%' : '0%'
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        uptime: uptimeString,
        uptimeMs: uptime,
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        successRate: successRate,
        failuresByReason: stats.failuresByReason,
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

