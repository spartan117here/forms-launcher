/**
 * forms-launcher - Main User Application Logic
 * 
 * Performance & Flicker-Free Architecture:
 * 1. Single Iframe: Existing in static HTML, src set only once per URL.
 * 2. Instant Start: Priority order: window.__FORM__ -> localStorage -> network.
 * 3. Exact URL Normalization: Ignores fragment and trailing slashes to prevent redundant src assignments.
 * 4. Zero Layout Shifts: Fixed-height subtitle, persistent online status pill, no animations or loaders.
 * 5. Clean Service Worker: Registered post-load with no forced reloads.
 */

(function () {
  'use strict';

  // DOM Elements
  const appTitleEl = document.getElementById('appTitle');
  const formSubtitleEl = document.getElementById('formSubtitle');
  const formIframeEl = document.getElementById('formIframe');
  const openExternalBtn = document.getElementById('openExternalBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const statusDotEl = document.getElementById('statusDot');
  const statusTextEl = document.getElementById('statusText');

  const errorOverlayEl = document.getElementById('errorOverlay');
  const emptyOverlayEl = document.getElementById('emptyOverlay');
  const setupOverlayEl = document.getElementById('setupOverlay');

  const retryBtn = document.getElementById('retryBtn');
  const emptyRefreshBtn = document.getElementById('emptyRefreshBtn');

  // Install Banner Elements
  const installBannerEl = document.getElementById('installBanner');
  const installAppBtn = document.getElementById('installAppBtn');
  const dismissInstallBtn = document.getElementById('dismissInstallBtn');

  // State
  let supabaseClient = null;
  let supabaseLoadingPromise = null;
  let activeNormalizedUrl = '';
  let currentRawUrl = null;
  let deferredInstallPrompt = null;

  const cacheKey = window.APP_CONFIG?.cacheKey || 'forms_launcher';

  /**
   * Format & normalize Google Form URL to ensure clean iframe embedding with ?embedded=true.
   * Strips hash/fragment and trailing slashes for exact string comparison.
   */
  function normalizeFormUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const url = new URL(rawUrl.trim(), window.location.origin);
      // Remove hash/fragment
      url.hash = '';
      // Remove trailing slash on pathname if not root
      if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
      }
      // Google Forms specific transforms
      if (url.hostname.includes('docs.google.com')) {
        if (url.pathname.endsWith('/edit')) {
          url.pathname = url.pathname.replace(/\/edit$/, '/viewform');
        }
        if (!url.searchParams.has('embedded')) {
          url.searchParams.set('embedded', 'true');
        }
      }
      return url.toString();
    } catch (e) {
      let u = rawUrl.trim().split('#')[0];
      if (u.length > 1 && u.endsWith('/')) {
        u = u.slice(0, -1);
      }
      return u;
    }
  }

  /**
   * Display toast notification
   */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  /**
   * Set network status indicator: stays strictly 'Online' or 'Offline' to avoid pill resizing.
   */
  function updateOnlineStatus() {
    if (!statusDotEl || !statusTextEl) return;
    if (navigator.onLine) {
      statusDotEl.className = 'status-dot';
      statusTextEl.textContent = 'Online';
    } else {
      statusDotEl.className = 'status-dot offline';
      statusTextEl.textContent = 'Offline';
    }
  }

  /**
   * Render form into iframe and update header details.
   * Compares normalized URLs and sets iframe.src ONLY if truly different.
   */
  function applyForm(formData) {
    if (!formData || !formData.url) return;
    const normalized = normalizeFormUrl(formData.url);
    if (!normalized) return;

    // Update Header
    if (appTitleEl && window.APP_CONFIG?.appName) {
      appTitleEl.textContent = window.APP_CONFIG.appName;
    }
    if (formData.title && formData.title.trim()) {
      if (formSubtitleEl) {
        formSubtitleEl.textContent = formData.title.trim();
      }
      document.title = `${formData.title.trim()} - ${window.APP_CONFIG?.appName || 'forms-launcher'}`;
    }
    if (openExternalBtn && formData.url) {
      openExternalBtn.href = formData.url;
    }

    currentRawUrl = formData.url;

    // Compare normalized URL with currently active iframe URL
    if (activeNormalizedUrl && activeNormalizedUrl === normalized) {
      // Identical form link; leave iframe completely untouched (no flicker, no reload)
      return;
    }

    // Set iframe source once
    activeNormalizedUrl = normalized;
    if (formIframeEl) {
      formIframeEl.src = normalized;
    }

    errorOverlayEl?.classList.add('hidden');
    emptyOverlayEl?.classList.add('hidden');
    setupOverlayEl?.classList.add('hidden');
  }

  /**
   * Source (a): Load from same-domain serverless API /api/current-link (8-second timeout)
   */
  async function fetchFromApi() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/current-link', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data || !data.url) {
        throw new Error('API returned empty link data');
      }
      return {
        url: data.url,
        title: data.title || '',
        updated_at: data.updated_at || data.created_at || new Date().toISOString()
      };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Dynamically loads supabase-js SDK on demand ONLY if /api/current-link fails
   */
  function loadSupabaseScript() {
    if (window.supabase) {
      return Promise.resolve();
    }
    if (!supabaseLoadingPromise) {
      supabaseLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Supabase SDK from CDN'));
        document.head.appendChild(script);
      });
    }
    return supabaseLoadingPromise;
  }

  /**
   * Source (b): Direct Supabase Fallback (8-second timeout)
   */
  async function fetchFromSupabaseDirect() {
    const cfg = window.APP_CONFIG;
    if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      throw new Error('Supabase client config missing');
    }

    await loadSupabaseScript();

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }

    const fetchPromise = supabaseClient
      .from('form_links')
      .select('url, title, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Direct Supabase fetch timed out (8s)')), 8000)
    );

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('No form links published in Supabase');
    }

    return {
      url: data[0].url,
      title: data[0].title || '',
      updated_at: data[0].created_at
    };
  }

  /**
   * Read cached form from localStorage
   */
  function getCachedForm() {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.url) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[FormLoader] Error reading cache:', e);
    }
    return null;
  }

  /**
   * Background Revalidation (stale-while-revalidate):
   * Checks /api/current-link. If URL is different, updates iframe and cache.
   * If URL is identical, leaves iframe untouched (no flicker).
   */
  async function backgroundRevalidate() {
    let freshData = null;

    // 1. Try /api/current-link
    try {
      freshData = await fetchFromApi();
    } catch (apiErr) {
      // 2. Try direct Supabase fallback
      try {
        freshData = await fetchFromSupabaseDirect();
      } catch (supaErr) {
        // unreachable
      }
    }

    if (freshData && freshData.url) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(freshData));
      } catch (e) {}
      applyForm(freshData);
    } else if (!activeNormalizedUrl) {
      // Both failed on initial open with no cache: show simple error overlay
      errorOverlayEl?.classList.remove('hidden');
      updateOnlineStatus();
    }
  }

  /**
   * Master initialization:
   * Order for choosing src: window.__FORM__ -> localStorage cache -> network.
   */
  function startFormLoading() {
    // 1. Injected server data (if present)
    if (window.__FORM__ && window.__FORM__.url) {
      applyForm(window.__FORM__);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(window.__FORM__));
      } catch (e) {}
    } else {
      // 2. Local cache (instant start)
      const cached = getCachedForm();
      if (cached && cached.url) {
        applyForm(cached);
      }
    }

    // 3. Network revalidation
    backgroundRevalidate();
  }

  /**
   * PWA Install Banner handling
   */
  function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (installBannerEl) {
        installBannerEl.classList.remove('hidden');
      }
    });

    if (installAppBtn) {
      installAppBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          if (isIOS) {
            alert('To install on iOS: Tap the Share button at the bottom of Safari, then select "Add to Home Screen".');
          }
          return;
        }

        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          showToast('Installing forms-launcher...', 'success');
        }
        deferredInstallPrompt = null;
        installBannerEl?.classList.add('hidden');
      });
    }

    if (dismissInstallBtn) {
      dismissInstallBtn.addEventListener('click', () => {
        installBannerEl?.classList.add('hidden');
      });
    }

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      installBannerEl?.classList.add('hidden');
      showToast('forms-launcher installed successfully!', 'success');
    });
  }

  /**
   * Service Worker Registration: only after window load, never reloads or modifies UI
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[SW] Registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[SW] Registration failed:', err);
          });
      });
    }
  }

  /**
   * Event Listeners
   */
  function initListeners() {
    retryBtn?.addEventListener('click', () => {
      startFormLoading();
    });

    emptyRefreshBtn?.addEventListener('click', () => {
      startFormLoading();
    });

    refreshBtn?.addEventListener('click', () => {
      showToast('Checking for latest form update...', 'info');
      backgroundRevalidate();
    });

    openExternalBtn?.addEventListener('click', (e) => {
      if (!currentRawUrl) {
        e.preventDefault();
        showToast('No form URL currently loaded.', 'error');
      }
    });

    window.addEventListener('online', () => {
      updateOnlineStatus();
      showToast('Back online! Syncing latest form...', 'info');
      backgroundRevalidate();
    });

    window.addEventListener('offline', () => {
      updateOnlineStatus();
      showToast('Internet disconnected. Offline mode active.', 'info');
    });
  }

  // Application Entry Point
  function init() {
    if (appTitleEl && window.APP_CONFIG?.appName) {
      appTitleEl.textContent = window.APP_CONFIG.appName;
      document.title = window.APP_CONFIG.appName;
    }

    updateOnlineStatus();
    initListeners();
    setupPWAInstall();
    registerServiceWorker();
    startFormLoading();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
