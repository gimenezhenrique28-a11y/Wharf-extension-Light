// ═══════════════════════════════════════════════════
// TALENT WHARF - Popup Script
// Controls the extension popup UI
// ═══════════════════════════════════════════════════

(function () {
  'use strict';

  // DOM references
  const connectionStatus = document.getElementById('connection-status');
  const notConnectedView = document.getElementById('not-connected-view');
  const connectedView = document.getElementById('connected-view');
  const todayCount = document.getElementById('today-count');
  const weekCount = document.getElementById('week-count');
  const totalCount = document.getElementById('total-count');
  const captureList = document.getElementById('capture-list');
  const capturePageBtn = document.getElementById('capture-page-btn');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const footerSettingsBtn = document.getElementById('footer-settings-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // ── Initialize ──
  async function init() {
    bindEvents();
    await checkConnection();
    await loadStats();
    await loadHistory();
    checkCurrentPage();
  }

  // ── Event Bindings ──
  function bindEvents() {
    openSettingsBtn?.addEventListener('click', openOptions);
    footerSettingsBtn?.addEventListener('click', openOptions);
    openDashboardBtn?.addEventListener('click', openDashboard);
    capturePageBtn?.addEventListener('click', captureCurrentPage);
    clearHistoryBtn?.addEventListener('click', clearHistory);
  }

  // ── Check API Connection ──
  async function checkConnection() {
    connectionStatus.className = 'status-dot status-checking';
    connectionStatus.title = 'Checking connection...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'CHECK_CONNECTION' });

      if (response.connected) {
        connectionStatus.className = 'status-dot status-connected';
        connectionStatus.title = 'Connected';
        notConnectedView.style.display = 'none';
        connectedView.style.display = 'block';
      } else {
        showDisconnected(response.error || 'Not connected');
      }
    } catch (err) {
      showDisconnected('Extension error');
    }
  }

  function showDisconnected(reason) {
    connectionStatus.className = 'status-dot status-disconnected';
    connectionStatus.title = reason;
    notConnectedView.style.display = 'block';
    connectedView.style.display = 'none';
  }

  // ── Load Stats ──
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_STATS' });
      if (response) {
        todayCount.textContent = response.today || 0;
        weekCount.textContent = response.week || 0;
        totalCount.textContent = response.total || 0;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // ── Load Capture History ──
  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_CAPTURE_HISTORY' });
      const history = response?.history || [];

      if (history.length === 0) {
        captureList.innerHTML = `
          <div class="empty-state small">
            <p>No captures yet. Visit a LinkedIn profile or Gmail thread to get started.</p>
          </div>`;
        return;
      }

      captureList.innerHTML = history.slice(0, 10).map(item => {
        const initials = getInitials(item.name);
        const sourceClass = (item.source || '').toLowerCase();
        const timeAgo = formatTimeAgo(item.timestamp);

        return `
          <div class="capture-item">
            <div class="capture-avatar ${sourceClass}">${initials}</div>
            <div class="capture-info">
              <div class="capture-name">${escapeHtml(item.name)}</div>
              <div class="capture-meta">${escapeHtml(item.source || 'Unknown')}${item.headline ? ' - ' + escapeHtml(item.headline) : ''}</div>
            </div>
            <span class="capture-time">${timeAgo}</span>
          </div>`;
      }).join('');
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  // ── Check if current page is capturable ──
  async function checkCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      const isLinkedIn = tab.url.includes('linkedin.com/in/');
      const isGmail = tab.url.includes('mail.google.com');

      if (isLinkedIn || isGmail) {
        capturePageBtn.disabled = false;
        capturePageBtn.querySelector('span')?.remove();
        const label = isLinkedIn ? 'Capture LinkedIn Profile' : 'Capture from Gmail';
        // Find the text node or create new label
        const textNodes = capturePageBtn.childNodes;
        for (let i = textNodes.length - 1; i >= 0; i--) {
          if (textNodes[i].nodeType === Node.TEXT_NODE) {
            textNodes[i].textContent = ` ${label}`;
            return;
          }
        }
      }
    } catch (err) {
      // Tab query might fail in some contexts
    }
  }

  // ── Capture from current page ──
  async function captureCurrentPage() {
    const btn = capturePageBtn;
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="wharf-spinner"></span> Capturing...`;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Execute content script extraction and capture
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Trigger the content script's capture function
          const captureBtn = document.getElementById('wharf-linkedin-capture-btn') ||
                            document.getElementById('wharf-gmail-capture-btn');
          if (captureBtn) {
            captureBtn.click();
            return { triggered: true };
          }
          return { triggered: false, error: 'Capture button not found on page' };
        },
      });

      const result = results?.[0]?.result;
      if (result?.triggered) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Triggered!`;
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
          loadStats();
          loadHistory();
        }, 2000);
      } else {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
      }
    } catch (err) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  // ── Clear History ──
  async function clearHistory() {
    try {
      await chrome.runtime.sendMessage({ action: 'CLEAR_HISTORY' });
      captureList.innerHTML = `
        <div class="empty-state small">
          <p>No captures yet. Visit a LinkedIn profile or Gmail thread to get started.</p>
        </div>`;
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  // ── Open Options Page ──
  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  // ── Open Dashboard ──
  async function openDashboard() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      const apiUrl = response?.config?.apiUrl || 'http://localhost:3000';
      // Dashboard is typically the frontend, strip the API path
      const dashboardUrl = apiUrl.replace(/\/api\/?$/, '').replace(':3001', ':3000');
      chrome.tabs.create({ url: dashboardUrl });
    } catch (err) {
      chrome.tabs.create({ url: 'http://localhost:3000' });
    }
  }

  // ── Helpers ──
  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Start ──
  init();
})();
