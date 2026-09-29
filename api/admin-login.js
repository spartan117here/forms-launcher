/**
 * Vercel Serverless Function: POST /api/admin-login
 * 
 * Proxies admin authentication server-side to Supabase Auth (/auth/v1/token?grant_type=password).
 * Allows admin login on networks that block direct client-side connections to *.supabase.co.
 * 
 * Uses public credentials (SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY) - never uses service_role.
 */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Server configuration missing: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not defined.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON request payload' });
    }
  }

  const { email, password } = body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const cleanBaseUrl = supabaseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanBaseUrl}/auth/v1/token?grant_type=password`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const supaRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    const data = await supaRes.json().catch(() => ({}));

    if (!supaRes.ok) {
      const msg = data.error_description || data.msg || data.message || '';
      if (supaRes.status === 400 || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        return res.status(401).json({ error: 'Wrong email or password' });
      }
      return res.status(supaRes.status).json({
        error: msg || 'Login failed. Please check your credentials.'
      });
    }

    if (!data.access_token) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }

    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      expires_at: data.expires_at,
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Could not reach the server, try again'
    });
  }
};
