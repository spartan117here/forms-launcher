/**
 * forms-launcher - Admin Portal Logic
 * 
 * Communicates EXCLUSIVELY through same-origin serverless endpoints:
 * - /api/admin-login
 * - /api/admin-links
 * 
 * Completely eliminates client-side browser calls to *.supabase.co,
 * resolving all network/ISP blocking issues on Windows and enterprise networks.
 * Keeps session token securely in sessionStorage.
 */

(function () {
  'use strict';

  // DOM Elements
  const authSection = document.getElementById('authSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const loginForm = document.getElementById('loginForm');
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginErrorMessage = document.getElementById('loginErrorMessage');
  const logoutBtn = document.getElementById('logoutBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const adminUserEmail = document.getElementById('adminUserEmail');

  const newLinkForm = document.getElementById('newLinkForm');
  const formTitleInput = document.getElementById('formTitle');
  const formUrlInput = document.getElementById('formUrl');
  const urlValidationError = document.getElementById('urlValidationError');
  const saveLinkBtn = document.getElementById('saveLinkBtn');
  const previewContainer = document.getElementById('previewContainer');
  const previewEmbedUrl = document.getElementById('previewEmbedUrl');

  const linksList = document.getElementById('linksList');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const refreshListBtn = document.getElementById('refreshListBtn');

  const TOKEN_KEY = 'fl_admin_token';
  const EMAIL_KEY = 'fl_admin_email';

  /**
   * Session helpers
   */
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function getEmail() {
    return sessionStorage.getItem(EMAIL_KEY);
  }

  function saveSession(token, email) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EMAIL_KEY, email);
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
  }

  /**
   * Helper to format Google Form URL with ?embedded=true
   */
  function formatEmbedUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
      const url = new URL(rawUrl.trim());
      if (url.pathname.endsWith('/edit')) {
        url.pathname = url.pathname.replace(/\/edit$/, '/viewform');
      }
      url.searchParams.set('embedded', 'true');
      return url.toString();
    } catch (e) {
      if (rawUrl.includes('?')) {
        return rawUrl.includes('embedded=true') ? rawUrl : rawUrl + '&embedded=true';
      }
      return rawUrl + '?embedded=true';
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
   * Format timestamp for readable display
   */
  function formatDate(isoDateString) {
    try {
      const d = new Date(isoDateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' at ' + d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoDateString;
    }
  }

  /**
   * Validate that URL starts with https://docs.google.com/forms/
   */
  function isGoogleFormUrl(url) {
    if (!url) return false;
    return url.trim().startsWith('https://docs.google.com/forms/');
  }

  /**
   * Toggle view between Auth Form and Dashboard
   */
  function updateAuthState() {
    const token = getToken();
    const email = getEmail();

    if (token && email) {
      authSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      logoutBtn.style.display = 'inline-flex';
      adminUserEmail.textContent = email;
      loadFormLinks();
    } else {
      authSection.style.display = 'block';
      dashboardSection.style.display = 'none';
      logoutBtn.style.display = 'none';
      adminUserEmail.textContent = '';
      linksList.innerHTML = '';
    }
  }

  /**
   * Sign In via serverless /api/admin-login
   */
  async function handleLogin(e) {
    e.preventDefault();
    loginErrorMessage.classList.remove('active');
    loginErrorMessage.textContent = '';

    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!email || !password) {
      loginErrorMessage.textContent = 'Please enter both email and password.';
      loginErrorMessage.classList.add('active');
      return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Signing in...';

    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Wrong email or password');
      }

      if (!data.access_token) {
        throw new Error('Wrong email or password');
      }

      saveSession(data.access_token, data.user?.email || email);
      showToast('Welcome back, Admin!', 'success');
      loginForm.reset();
      updateAuthState();
    } catch (err) {
      console.error('Sign-in error:', err);
      const friendlyMsg = err.message === 'Failed to fetch'
        ? 'Could not reach the server, try again'
        : (err.message || 'Wrong email or password');
      loginErrorMessage.textContent = friendlyMsg;
      loginErrorMessage.classList.add('active');
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Sign In to Dashboard';
    }
  }

  /**
   * Sign Out
   */
  function handleLogout() {
    clearSession();
    updateAuthState();
    showToast('Signed out successfully.', 'info');
  }

  /**
   * Live URL input validation & embedded preview
   */
  function handleUrlInput() {
    const rawVal = formUrlInput.value.trim();

    if (!rawVal) {
      urlValidationError.classList.remove('active');
      previewContainer.style.display = 'none';
      return;
    }

    if (isGoogleFormUrl(rawVal)) {
      urlValidationError.classList.remove('active');
      previewEmbedUrl.textContent = formatEmbedUrl(rawVal);
      previewContainer.style.display = 'block';
    } else {
      urlValidationError.classList.add('active');
      previewContainer.style.display = 'none';
    }
  }

  /**
   * Publish new form link via serverless /api/admin-links
   */
  async function handleSaveLink(e) {
    e.preventDefault();

    const title = formTitleInput.value.trim();
    const url = formUrlInput.value.trim();

    if (!isGoogleFormUrl(url)) {
      urlValidationError.classList.add('active');
      formUrlInput.focus();
      return;
    }

    const token = getToken();
    if (!token) {
      showToast('Session expired. Please sign in again.', 'error');
      clearSession();
      updateAuthState();
      return;
    }

    saveLinkBtn.disabled = true;
    saveLinkBtn.textContent = 'Publishing...';

    try {
      const res = await fetch('/api/admin-links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ title, url })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          updateAuthState();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(data.error || 'Failed to publish form');
      }

      showToast('Form published successfully! It is now live for all users.', 'success');
      newLinkForm.reset();
      previewContainer.style.display = 'none';
      loadFormLinks();
    } catch (err) {
      console.error('Insert error:', err);
      const friendlyMsg = err.message === 'Failed to fetch'
        ? 'Could not reach the server, try again'
        : (err.message || 'Error publishing form.');
      showToast(friendlyMsg, 'error');
    } finally {
      saveLinkBtn.disabled = false;
      saveLinkBtn.textContent = 'Publish Form';
    }
  }

  /**
   * Load history of form links via serverless /api/admin-links
   */
  async function loadFormLinks() {
    const token = getToken();
    if (!token) {
      updateAuthState();
      return;
    }

    linksList.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Loading form links...</div>';
    adminEmptyState.style.display = 'none';

    try {
      const res = await fetch('/api/admin-links', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          updateAuthState();
          showToast('Session expired. Please sign in again.', 'error');
          return;
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load form links');
      }

      const data = await res.json();
      linksList.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        adminEmptyState.style.display = 'block';
        return;
      }

      data.forEach((item, index) => {
        const isCurrent = index === 0;
        const itemEl = document.createElement('div');
        itemEl.className = `link-item ${isCurrent ? 'is-active' : ''}`;

        const embedPreview = formatEmbedUrl(item.url);

        itemEl.innerHTML = `
          <div class="link-item-header">
            <div class="link-title-group">
              <span class="link-title">${escapeHtml(item.title || 'Untitled Form')}</span>
              ${isCurrent
                ? '<span class="badge-active">LIVE (CURRENT)</span>'
                : '<span class="badge-archived">ARCHIVED</span>'
              }
            </div>
            <span class="link-meta">${formatDate(item.created_at)}</span>
          </div>

          <div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="link-url-text" title="Open Google Form">
              ${escapeHtml(item.url)} &nearr;
            </a>
          </div>

          <div class="link-actions">
            <a href="${escapeHtml(embedPreview)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Preview embedded form">
              Preview Embedded
            </a>
            <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}" data-title="${escapeHtml(item.title || 'Untitled Form')}">
              Delete
            </button>
          </div>
        `;

        linksList.appendChild(itemEl);
      });

      // Attach delete listeners
      document.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.addEventListener('click', handleDeleteLink);
      });
    } catch (err) {
      console.error('Fetch links error:', err);
      const friendlyMsg = err.message === 'Failed to fetch'
        ? 'Could not reach the server, try again'
        : (err.message || 'Unknown error');
      linksList.innerHTML = `
        <div style="color: #fb7185; padding: 16px; background: rgba(244, 63, 94, 0.1); border-radius: 8px;">
          Failed to load forms: ${escapeHtml(friendlyMsg)}
        </div>
      `;
    }
  }

  /**
   * Delete form link via serverless /api/admin-links
   */
  async function handleDeleteLink(e) {
    const id = e.currentTarget.getAttribute('data-id');
    const title = e.currentTarget.getAttribute('data-title');

    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    const token = getToken();
    if (!token) {
      showToast('Session expired. Please sign in again.', 'error');
      clearSession();
      updateAuthState();
      return;
    }

    try {
      const res = await fetch(`/api/admin-links?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          updateAuthState();
          throw new Error('Session expired. Please sign in again.');
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete form link');
      }

      showToast('Form link deleted successfully.', 'success');
      loadFormLinks();
    } catch (err) {
      console.error('Delete error:', err);
      const friendlyMsg = err.message === 'Failed to fetch'
        ? 'Could not reach the server, try again'
        : (err.message || 'Failed to delete form link.');
      showToast(friendlyMsg, 'error');
    }
  }

  /**
   * HTML escaping helper
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Initialize Admin Application
   */
  function init() {
    updateAuthState();

    // Password show/hide eye toggle
    togglePasswordBtn?.addEventListener('click', () => {
      const isPassword = loginPasswordInput.type === 'password';
      loginPasswordInput.type = isPassword ? 'text' : 'password';

      const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
      const eyeOffIcon = togglePasswordBtn.querySelector('.eye-off-icon');
      if (eyeIcon) eyeIcon.style.display = isPassword ? 'none' : 'block';
      if (eyeOffIcon) eyeOffIcon.style.display = isPassword ? 'block' : 'none';

      const label = isPassword ? 'Hide password' : 'Show password';
      togglePasswordBtn.setAttribute('aria-label', label);
      togglePasswordBtn.setAttribute('title', label);
    });

    // Theme toggle button
    themeToggleBtn?.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      try {
        localStorage.setItem('app_theme', newTheme);
      } catch (e) {}

      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', newTheme === 'light' ? '#ffffff' : '#0b0d14');
      }
    });

    loginForm?.addEventListener('submit', handleLogin);
    logoutBtn?.addEventListener('click', handleLogout);
    newLinkForm?.addEventListener('submit', handleSaveLink);
    formUrlInput?.addEventListener('input', handleUrlInput);
    refreshListBtn?.addEventListener('click', loadFormLinks);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
