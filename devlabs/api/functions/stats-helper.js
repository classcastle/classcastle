/**
 * Stats Helper Module
 * Records API statistics to Supabase for persistent tracking
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

/**
 * Record a successful request for an endpoint
 */
async function recordHit(endpoint) {
  if (!supabaseUrl || !supabaseKey) return;

  try {
    // Update endpoint stats
    await fetch(`${supabaseUrl}/rest/v1/api_stats?endpoint=eq.${endpoint}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        hits: `global.hits + 1`,
        last_updated: new Date().toISOString()
      })
    });

    // Update global stats
    await fetch(`${supabaseUrl}/rest/v1/api_global_stats?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        total_requests: `global.total_requests + 1`,
        successful_requests: `global.successful_requests + 1`,
        last_updated: new Date().toISOString()
      })
    });
  } catch (error) {
    // Silently fail to avoid breaking API calls
    console.error('Failed to record stats hit:', error.message);
  }
}

/**
 * Record a failed request for an endpoint with reason
 */
async function recordFailure(endpoint, reason) {
  if (!supabaseUrl || !supabaseKey) return;

  try {
    // Update endpoint stats
    await fetch(`${supabaseUrl}/rest/v1/api_stats?endpoint=eq.${endpoint}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        failures: `global.failures + 1`,
        last_updated: new Date().toISOString()
      })
    });

    // Update global stats
    await fetch(`${supabaseUrl}/rest/v1/api_global_stats?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        total_requests: `global.total_requests + 1`,
        failed_requests: `global.failed_requests + 1`,
        last_updated: new Date().toISOString()
      })
    });

    // Update failures by reason
    const existingReason = await fetch(`${supabaseUrl}/rest/v1/api_failures?reason=eq.${encodeURIComponent(reason)}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const reasonData = await existingReason.json();

    if (reasonData && reasonData.length > 0) {
      // Update existing reason
      await fetch(`${supabaseUrl}/rest/v1/api_failures?id=eq.${reasonData[0].id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          count: `global.count + 1`,
          last_updated: new Date().toISOString()
        })
      });
    } else {
      // Insert new reason
      await fetch(`${supabaseUrl}/rest/v1/api_failures`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          reason: reason,
          count: 1
        })
      });
    }
  } catch (error) {
    // Silently fail to avoid breaking API calls
    console.error('Failed to record stats failure:', error.message);
  }
}

module.exports = { recordHit, recordFailure };
