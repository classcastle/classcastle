/**
 * Cloudflare Middleware for Maintenance Mode
 * 
 * Checks the IN_MAINTENANCE environment variable.
 * If set to true, returns a maintenance page for all requests.
 * If set to false or not set, allows normal routing.
 */

export const onRequest = async (context) => {
  const { request, env } = context;
  
  // Check if maintenance mode is enabled
  if (env.IN_MAINTENANCE === 'true') {
    // Return maintenance page
    const maintenanceHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maintenance Mode - Classcastle</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    h1 {
      color: #333;
      font-size: 28px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    p {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .note {
      font-size: 14px;
      color: #999;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔧</div>
    <h1>We'll Be Right Back!</h1>
    <p>Classcastle is currently undergoing scheduled maintenance. We're working hard to bring you a better experience.</p>
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
