// ═══════════════════════════════════════════════════
// TALENT WHARF - Extension Configuration
// ═══════════════════════════════════════════════════
// These are PUBLIC keys only — safe to ship in the extension.
// The anon key has Row Level Security (RLS) enforcing access.
// The API key (secret) is stored in chrome.storage.local
// and entered by the user via the Options page.
// ═══════════════════════════════════════════════════

const WHARF_CONFIG = {
  // Supabase (public — safe to include in extension)
  SUPABASE_URL: 'https://yfhwmbywrgzkdddwddtd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIcCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmaHdtYnl3cmd6a2RkZHdkZHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDE2MTcsImV4cCI6MjA4NjY3NzYxN30.v8ZOqCoRUMACt_itCnrnzVCz21-M_ZdWHbQXI5Db9wc',

  // Default backend API URL (user can override in Options page)
  DEFAULT_API_URL: 'http://localhost:3001',

  // Production API URL (used when not localhost)
  PRODUCTION_API_URL: 'https://api.talentwharf.com',

  // Extension version
  VERSION: '1.0.0',
};

// Make available globally for content scripts & service worker
if (typeof globalThis !== 'undefined') {
  globalThis.WHARF_CONFIG = WHARF_CONFIG;
}
