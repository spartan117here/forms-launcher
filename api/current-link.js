/**
 * Vercel Serverless Function: GET /api/current-link
 * 
 * Fetches the newest active Google Form link from Supabase server-side.
 * Resolves restrictions on enterprise/campus/ISP networks that block client-side
 * connections to *.supabase.co.
 * 
 * Uses only public/publishable credentials (SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY).
 * Never caches stale links: returns Cache-Control: no-store.
 */

module.exports = async (req, res) => {
  // Cache-Control: fast edge caching with instant stale revalidation
  res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Allow GET only
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Server configuration missing: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not defined in environment variables.'
    });
  }

  try {
    const cleanBaseUrl = supabaseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanBaseUrl}/rest/v1/form_links?select=id,title,url,created_at&order=created_at.desc&limit=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const supaRes = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!supaRes.ok) {
      const errBody = await supaRes.text();
      return res.status(supaRes.status).json({
        error: 'Supabase returned an error response',
        status: supaRes.status,
        details: errBody
      });
    }

    const rows = await supaRes.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({
        error: 'No form links published yet in database'
      });
    }

    const latest = rows[0];
    return res.status(200).json({
      title: latest.title || 'Untitled Form',
      url: latest.url
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Failed to communicate with Supabase',
      message: err.message
    });
  }
};
