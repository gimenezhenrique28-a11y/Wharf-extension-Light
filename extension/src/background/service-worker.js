// ═══════════════════════════════════════════════════
// TALENT WHARF - Background Service Worker (MV3)
// Handles API communication and state management
// ═══════════════════════════════════════════════════

importScripts('../config.js');

const DEFAULT_API_URL = (typeof WHARF_CONFIG !== 'undefined' && WHARF_CONFIG.DEFAULT_API_URL)
  || 'http://localhost:3001';

// ── Message Router ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true; // Keep channel open for async
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'CAPTURE_CANDIDATE':
      return captureCandidate(message.data);
    case 'GET_CONFIG':
      return getConfig();
    case 'SET_CONFIG':
      return setConfig(message.data);
    case 'CHECK_CONNECTION':
      return checkConnection();
    case 'GET_CAPTURE_HISTORY':
      return getCaptureHistory();
    case 'CLEAR_HISTORY':
      return clearHistory();
    case 'GET_STATS':
      return getStats();
    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}

// ── Capture Candidate ──
async function captureCandidate(data) {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error('API key not configured. Click the extension icon to set it up.');
  }

  const payload = {
    name: data.name,
    email: data.email || null,
    headline: data.headline || null,
    linkedin_url: data.linkedinUrl || data.linkedin_url || null,
    about: data.about || null,
    skills: data.skills || [],
    experience: data.experience || [],
    source: data.source || 'Extension',
    notes: data.notes || null,
    capturedAt: new Date().toISOString(),
    capturedFrom: data.capturedFrom || null,
  };

  try {
    const response = await fetch(`${config.apiUrl}/api/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      await addCaptureRecord({
        name: data.name,
        source: data.source || 'Extension',
        success: false,
        error: result.error || `HTTP ${response.status}`,
      });

      if (response.status === 409) {
        return {
          success: false,
          duplicate: true,
          existingId: result.existingId,
          error: result.error || 'Candidate already exists',
        };
      }

      throw new Error(result.error || `HTTP ${response.status}`);
    }

    // Success
    await addCaptureRecord({
      id: result.id,
      name: data.name,
      source: data.source || 'Extension',
      success: true,
    });

    // Update badge count
    await updateBadge();

    // Show notification if enabled
    if (config.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon-128.png'),
        title: 'Candidate Captured',
        message: `${data.name} added to your pipeline`,
      });
    }

    return { success: true, candidate: result };
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Cannot reach Talent Wharf API. Check your connection and API URL.');
    }
    throw error;
  }
}

// ── Config Management ──
async function getConfig() {
  const result = await chrome.storage.local.get([
    'apiKey', 'apiUrl', 'autoCapture', 'showNotifications'
  ]);
  return {
    apiKey: result.apiKey || '',
    apiUrl: result.apiUrl || DEFAULT_API_URL,
    autoCapture: result.autoCapture ?? false,
    showNotifications: result.showNotifications ?? true,
  };
}

async function setConfig(updates) {
  await chrome.storage.local.set(updates);
  return { success: true };
}

// ── Connection Check ──
async function checkConnection() {
  const config = await getConfig();
  if (!config.apiKey) {
    return { connected: false, reason: 'No API key configured' };
  }

  try {
    const response = await fetch(`${config.apiUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { connected: false, reason: `Server returned ${response.status}` };
    }

    const data = await response.json();
    return { connected: true, serverStatus: data.status };
  } catch (error) {
    return { connected: false, reason: error.message };
  }
}

// ── Capture History ──
async function addCaptureRecord(record) {
  const { captureHistory = [] } = await chrome.storage.local.get('captureHistory');
  captureHistory.unshift({
    ...record,
    capturedAt: new Date().toISOString(),
  });
  // Keep last 200 entries
  await chrome.storage.local.set({
    captureHistory: captureHistory.slice(0, 200),
  });
}

async function getCaptureHistory() {
  const { captureHistory = [] } = await chrome.storage.local.get('captureHistory');
  return captureHistory;
}

async function clearHistory() {
  await chrome.storage.local.set({ captureHistory: [] });
  await chrome.action.setBadgeText({ text: '' });
  return { success: true };
}

// ── Stats ──
async function getStats() {
  const { captureHistory = [] } = await chrome.storage.local.get('captureHistory');
  const today = new Date().toISOString().split('T')[0];
  const todayCaptures = captureHistory.filter(r =>
    r.success && r.capturedAt?.startsWith(today)
  );
  return {
    todayCount: todayCaptures.length,
    totalCount: captureHistory.filter(r => r.success).length,
    failedCount: captureHistory.filter(r => !r.success).length,
  };
}

// ── Badge ──
async function updateBadge() {
  const { captureHistory = [] } = await chrome.storage.local.get('captureHistory');
  const today = new Date().toISOString().split('T')[0];
  const todayCount = captureHistory.filter(r =>
    r.success && r.capturedAt?.startsWith(today)
  ).length;

  if (todayCount > 0) {
    chrome.action.setBadgeText({ text: String(todayCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#000000' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Reset badge daily
chrome.alarms.create('resetBadge', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'resetBadge') {
    updateBadge();
  }
});

// On install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'src/options/options.html' });
  }
});
