/**
 * Cloudflare Middleware for Maintenance Mode
 * 
 * Checks the IN_MAINTENANCE environment variable.
 * If set to true, returns a maintenance page for all requests.
 * If set to false or not set, allows normal routing.
 */

// Maintenance Mode - Set to true to enable
const IN_MAINTENANCE = true;

// Maintenance Reason - Customize this message
const MAINTENANCE_REASON = "We are working on moving away from Supabase to Appwrite for improved performance and reliability.";

export const onRequest = async (context) => {
  const { request, env } = context;
  
  // Check if maintenance mode is enabled (from env var or hardcoded)
  const isMaintenance = env.IN_MAINTENANCE === 'true' || IN_MAINTENANCE === true;
  
  // Get reason from env var or use default
  const reason = env.MAINTENANCE_REASON || MAINTENANCE_REASON;
  
  if (isMaintenance) {
    // Return maintenance page with Classcastle styling
    const maintenanceHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Maintenance Mode - Classcastle</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #FCFCFA;
      --surface: #fff;
      --ink: #18221C;
      --soft: #5E675F;
      --line: #D9DDD3;
      --brand: #1F5C3A;
      --tint: #E4F1E6;
      --board: #17352A;
      --chalk: #F4D35E;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0F1511;
        --surface: #18211B;
        --ink: #EEF2EA;
        --soft: #9EAA9F;
        --line: #2A362D;
        --brand: #4DAA72;
        --tint: #1A2B20;
        --board: #1C4030;
        --chalk: #F4D35E;
      }
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Instrument Sans', system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 48px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }
    .logo {
      font-size: 48px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .logo-mark {
      width: 48px;
      height: 48px;
    }
    h1 {
      color: var(--ink);
      font-size: 28px;
      margin-bottom: 16px;
      font-weight: 400;
      letter-spacing: -0.015em;
    }
    p {
      color: var(--soft);
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .reason {
      background: var(--tint);
      color: var(--brand);
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--line);
      border-top-color: var(--brand);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .note {
      font-size: 14px;
      color: var(--soft);
      margin-top: 16px;
    }
    .wordmark {
      font-family: 'Instrument Sans', system-ui, sans-serif;
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .word-accent {
      color: var(--brand);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="/logo.svg" alt="" class="logo-mark" onerror="this.style.display='none'">
      <div class="wordmark">Class<span class="word-accent">castle</span></div>
    </div>
    <h1>We'll Be Right Back!</h1>
    <p>Classcastle is currently undergoing scheduled maintenance. We're working hard to bring you a better experience.</p>
    <div class="reason">
      <strong>Reason:</strong> ${reason}
    </div>
    <div class="spinner"></div>
    <p class="note">Please check back soon. Thank you for your patience!</p>
  </div>
</body>
</html>
    `;

    return new Response(maintenanceHtml, {
      status: 503,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Retry-After': '3600',
      },
    });
  }

  // If not in maintenance mode, continue normal routing
  return context.next();
};
