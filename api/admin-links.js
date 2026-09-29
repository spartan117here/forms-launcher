/**
 * Vercel Serverless Function: /api/admin-links
 * 
 * Supports:
 * - GET: List all form links
 * - POST: Insert a new form link (validates Google Form URL format)
 * - DELETE: Remove a form link by ID
 * 
 * Forwards the user's access_token as the Bearer token to Supabase REST,
 * ensuring Supabase Row Level Security (RLS) strictly governs permissions.
 * Never uses service_role or secret keys.
 */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Server configuration missing: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not defined.'
    });
  }

  // Extract user's Bearer token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const cleanBaseUrl = supabaseUrl.replace(/\/+$/, '');
  const baseHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // 1. GET: List all links
    if (req.method === 'GET') {
      const endpoint = `${cleanBaseUrl}/rest/v1/form_links?select=id,title,url,created_at&order=created_at.desc`;
      const supaRes = await fetch(endpoint, {
        method: 'GET',
        headers: baseHeaders,
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!supaRes.ok) {
        if (supaRes.status === 401 || supaRes.status === 403) {
          return res.status(401).json({ error: 'Session expired or unauthorized. Please sign in again.' });
        }
        return res.status(supaRes.status).json({ error: 'Failed to load form links from database' });
      }

      const rows = await supaRes.json();
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    }

    // 2. POST: Add a new form link
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON request payload' });
        }
      }

      const { title, url } = body || {};

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Google Form URL is required' });
      }

      const trimmedUrl = url.trim();
      if (!trimmedUrl.startsWith('https://docs.google.com/forms/')) {
        return res.status(400).json({ error: 'URL must start with https://docs.google.com/forms/' });
      }

      const cleanTitle = (title && typeof title === 'string' && title.trim()) ? title.trim() : 'Google Form';

      const endpoint = `${cleanBaseUrl}/rest/v1/form_links`;
      const supaRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title: cleanTitle,
          url: trimmedUrl
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!supaRes.ok) {
        const errText = await supaRes.text();
        if (supaRes.status === 401 || supaRes.status === 403 || errText.includes('row-level security')) {
          return res.status(403).json({
            error: 'Permission denied: only authorized administrator (spartan117here@gmail.com) can publish forms.'
          });
        }
        return res.status(supaRes.status).json({ error: 'Failed to publish form link', details: errText });
      }

      const created = await supaRes.json();
      return res.status(201).json(Array.isArray(created) ? created[0] : created);
    }

    // 3. DELETE: Remove a form link
    if (req.method === 'DELETE') {
      let id = req.query?.id;
      if (!id && req.body) {
        let body = req.body;
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch (e) {}
        }
        id = body?.id;
      }

      if (!id) {
        return res.status(400).json({ error: 'Link ID is required for deletion' });
      }

      const endpoint = `${cleanBaseUrl}/rest/v1/form_links?id=eq.${encodeURIComponent(id)}`;
      const supaRes = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          ...baseHeaders,
          'Prefer': 'return=representation'
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!supaRes.ok) {
        const errText = await supaRes.text();
        if (supaRes.status === 401 || supaRes.status === 403 || errText.includes('row-level security')) {
          return res.status(403).json({
            error: 'Permission denied: only authorized administrator (spartan117here@gmail.com) can delete forms.'
          });
        }
        return res.status(supaRes.status).json({ error: 'Failed to delete form link' });
      }

      return res.status(200).json({ success: true, deletedId: id });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(502).json({
      error: 'Could not reach the server, try again'
    });
  }
};
