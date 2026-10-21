/**
 * Send Welcome Email
 * POST /send-welcome-email
 * Sends a welcome email using Resend API
 */

export const onRequestPost = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const resendApiKey = env.RESEND_API_KEY;

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Resend API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const emailData = {
      from: 'devlabs.noreply@email.classcastle.org',
      to: email,
      subject: 'Welcome to the Classcastle API',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Classcastle API</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #FCFCFA;
      --surface: #ffffff;
      --ink: #18221C;
      --soft: #5E675F;
      --line: #D9DDD3;
      --brand: #1F5C3A;
      --brand-ink: #fff;
      --tint: #E4F1E6;
      --board: #17352A;
      --chalk: #F4D35E;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg);
      color: var(--ink);
      font-family: 'Instrument Sans', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
    }
    .container {
      background-color: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 40px;
    }
    .wordmark {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.3rem;
      margin-bottom: 32px;
    }
    .logo-mark {
      width: 26px;
      height: 26px;
    }
    .word-accent {
      color: var(--brand);
    }
    h1 {
      font-size: 2rem;
      font-weight: 400;
      line-height: 1.15;
      margin: 0 0 16px 0;
    }
    p {
      margin: 0 0 20px 0;
      color: var(--soft);
      font-size: 1.02rem;
      line-height: 1.6;
    }
    .btn-primary {
      background: var(--brand);
      color: var(--brand-ink);
      text-decoration: none;
      font-weight: 600;
      padding: 14px 24px;
      border-radius: 6px;
      display: inline-block;
      box-shadow: 3px 3px 0 var(--ink);
      margin-top: 10px;
      margin-bottom: 24px;
    }
    .code-block {
      background: var(--ink);
      color: var(--bg);
      padding: 16px 20px;
      border-radius: 6px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      margin: 20px 0;
    }
    .footer {
      margin-top: 32px;
      text-align: center;
      font-size: 0.85rem;
      color: var(--soft);
      border-top: 1px solid var(--line);
      padding-top: 20px;
    }
    .footer a {
      color: var(--soft);
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="wordmark">
        <img src="https://classcastle.org/logo.svg" alt="" class="logo-mark">
        <span>Class<span class="word-accent">castle</span> Dev Labs</span>
      </div>

      <h1>Welcome to the API</h1>
      
      <p>Our developer API lets you integrate Classcastle into your own tools. Create custom dashboards, automate room management, and extend classroom management however you need.</p>
      
      <p>To get started, make sure you have generated your API key and included it as a Bearer token in your request headers:</p>

      <div class="code-block">
        Authorization: Bearer your_api_key_here
      </div>

      <p>Please make sure to review our <a href="https://classcastle.org/terms.html" style="color: var(--brand); font-weight: 600;">Terms of Service</a> before making requests to ensure compliance with API usage guidelines.</p>

      <p>Ready to build custom integrations or automate your workflows? Head over to Dev Labs to check out the documentation and core endpoints.</p>

      <a class="btn-primary" href="https://devlabs.classcastle.org">Explore Dev Labs</a>

      <div class="footer">
        <p style="margin: 0; font-size: 0.85rem; color: var(--soft);">
          Questions? Contact us at <a href="mailto:hello@classcastle.org">hello@classcastle.org</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to send email', details: result }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, messageId: result.id }), {
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
