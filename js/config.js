/**
 * ============================================================================
 * APP CONFIGURATION & SUPABASE CREDENTIALS
 * ============================================================================
 * Replace the placeholders below with your Supabase Project settings.
 * Find them at: https://app.supabase.com/project/_/settings/api
 *
 * 1. SUPABASE_URL: Project URL (e.g., https://xyzcompany.supabase.co)
 * 2. SUPABASE_ANON_KEY: Project API anon/public key (starts with "eyJ...")
 * ============================================================================
 */

window.APP_CONFIG = {
  // App display name used throughout UI and PWA
  appName: "forms-launcher",

  // Supabase Project URL & Publishable Key
  supabaseUrl: "https://xuldqiftdkkrmidscsrx.supabase.co",
  supabaseAnonKey: "sb_publishable_W8X9y3XC9c9kwLK5z-jWxw_fnzx9gKt",

  // LocalStorage key for caching the latest form link (lowercase, underscore version)
  cacheKey: "forms_launcher",

  // Helper helper to check if credentials have been replaced
  isConfigured() {
    return (
      Boolean(this.supabaseUrl) &&
      Boolean(this.supabaseAnonKey) &&
      this.supabaseUrl !== "YOUR_SUPABASE_URL" &&
      this.supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY" &&
      this.supabaseUrl.startsWith("https://")
    );
  }
};
