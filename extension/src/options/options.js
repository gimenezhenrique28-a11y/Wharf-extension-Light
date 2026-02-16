// ═══════════════════════════════════════════════════
// TALENT WHARF - Options Page Script
// Settings management for the Chrome extension
// ═══════════════════════════════════════════════════

(function () {
  'use strict';

  // DOM references
  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const apiUrlInput = document.getElementById('api-url');
  const apiKeyInput = document.getElementById('api-key');
  const toggleKeyBtn = document.getElementById('toggle-key-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const saveBtn = document.getElementById('save-btn');
  const showNotificationsToggle = document.getElementById('show-notifications');
  const autoCaptureToggle = document.getElementById('auto-capture');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const exportHistoryBtn = document.getElementById('export-history-btn');

  let keyVisible = false;

  // ── Initialize ──
  async function init() {
    bindEvents();
    await loadConfig();
    await checkConnection();
  }

  // ── Event Bindings ──
  function bindEvents() {
    toggleKeyBtn.addEventListener('click', toggleKeyVisibility);
    testConnectionBtn.addEventListener('click', testConnection);
    saveBtn.addEventListener('click', saveSettings);
    clearHistoryBtn.addEventListener('click', clearHistory);
    exportHistoryBtn.addEventListener('click', exportHistory);
  }

  // ── Load Config ──
  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      const config = response?.config || {};

      apiUrlInput.value = config.apiUrl || 'http://localhost:3001/api';
      apiKeyInput.value = config.apiKey || '';
      showNotificationsToggle.checked = config.showNotifications !== false;
      autoCaptureToggle.checked = config.autoCapture === true;
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

  // ── Save Settings ──
  async function saveSettings() {
    const btn = saveBtn;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const config = {
        apiUrl: apiUrlInput.value.trim().replace(/\/+$/, ''),
        apiKey: apiKeyInput.value.trim(),
        showNotifications: showNotificationsToggle.checked,
        autoCapture: autoCaptureToggle.checked,
      };

      // Validate URL
      if (config.apiUrl && !isValidUrl(config.apiUrl)) {
        showStatus('error', 'Invalid API URL format');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }

      await chrome.runtime.sendMessage({ action: 'SET_CONFIG', data: config });

      btn.textContent = 'Saved!';
      btn.style.background = '#059669';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);

      // Re-check connection with new settings
      await checkConnection();
    } catch (err) {
      btn.textContent = 'Error';
      btn.style.background = '#dc2626';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);
    }
  }

  // ── Test Connection ──
  async function testConnection() {
    const btn = testConnectionBtn;
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span>Testing...</span>`;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'CHECK_CONNECTION' });

      if (response.connected) {
        showStatus('connected', 'Connected to Talent Wharf API');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Connected!`;
      } else {
        showStatus('error', response.error || 'Connection failed');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Failed`;
      }
    } catch (err) {
      showStatus('error', 'Extension communication error');
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Error`;
    }

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 3000);
  }

  // ── Check Connection Status ──
  async function checkConnection() {
    try {
      const config = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      if (!config?.config?.apiKey) {
        showStatus('unknown', 'Enter your API key to connect');
        return;
      }

      const response = await chrome.runtime.sendMessage({ action: 'CHECK_CONNECTION' });
      if (response.connected) {
        showStatus('connected', 'Connected to Talent Wharf API');
      } else {
        showStatus('error', response.error || 'Not connected');
      }
    } catch (err) {
      showStatus('error', 'Extension error');
    }
  }

  // ── Toggle API Key Visibility ──
  function toggleKeyVisibility() {
    keyVisible = !keyVisible;
    apiKeyInput.type = keyVisible ? 'text' : 'password';
    toggleKeyBtn.innerHTML = keyVisible
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
           <line x1="1" y1="1" x2="23" y2="23"/>
         </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
           <circle cx="12" cy="12" r="3"/>
         </svg>`;
  }

  // ── Clear History ──
  async function clearHistory() {
    if (!confirm('Clear all capture history? This cannot be undone.')) return;

    try {
      await chrome.runtime.sendMessage({ action: 'CLEAR_HISTORY' });
      clearHistoryBtn.textContent = 'Cleared!';
      setTimeout(() => {
        clearHistoryBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear Capture History`;
      }, 2000);
    } catch (err) {
      console.error('Clear failed:', err);
    }
  }

  // ── Export History ──
  async function exportHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_CAPTURE_HISTORY' });
      const history = response?.history || [];

      if (history.length === 0) {
        alert('No capture history to export.');
        return;
      }

      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `talent-wharf-captures-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  // ── Show Status Banner ──
  function showStatus(type, message) {
    statusText.textContent = message;
    statusBanner.className = 'status-banner';

    switch (type) {
      case 'connected':
        statusBanner.classList.add('status-connected');
        break;
      case 'error':
        statusBanner.classList.add('status-disconnected');
        break;
      default:
        statusBanner.classList.add('status-unknown');
    }
  }

  // ── URL Validation ──
  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // ── Start ──
  init();
})();
