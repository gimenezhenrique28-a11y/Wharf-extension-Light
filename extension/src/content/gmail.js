// ═══════════════════════════════════════════════════
// TALENT WHARF - Gmail Content Script
// Extracts candidate info from email threads
// ═══════════════════════════════════════════════════

(function() {
  'use strict';

  if (window.__wharfGmailLoaded) return;
  window.__wharfGmailLoaded = true;

  let captureButton = null;
  let currentEmailData = null;

  function init() {
    // Gmail is an SPA - watch for navigation
    const observer = new MutationObserver(debounce(checkForEmail, 500));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function checkForEmail() {
    // Check if we're viewing an email thread
    const emailView = document.querySelector('.adn.ads, .nH .nH .nH.if');
    if (!emailView) {
      removeCaptureButton();
      return;
    }

    // Don't re-inject if button already exists and is in DOM
    if (captureButton && document.body.contains(captureButton)) return;

    const emailData = extractEmailData();
    if (emailData && emailData.senderName) {
      currentEmailData = emailData;
      injectCaptureButton();
    }
  }

  function extractEmailData() {
    const data = {
      senderName: '',
      senderEmail: '',
      subject: '',
      bodySnippet: '',
      source: 'Gmail',
      capturedFrom: location.href,
    };

    // Sender info
    const senderEl = document.querySelector('.gD, .go');
    if (senderEl) {
      data.senderName = senderEl.getAttribute('name') || senderEl.textContent.trim();
      data.senderEmail = senderEl.getAttribute('email') || '';
    }

    // Subject
    const subjectEl = document.querySelector('.hP, h2.hP');
    if (subjectEl) {
      data.subject = subjectEl.textContent.trim();
    }

    // Body snippet (first 500 chars)
    const bodyEl = document.querySelector('.a3s.aiL, .a3s');
    if (bodyEl) {
      data.bodySnippet = bodyEl.textContent.trim().substring(0, 500);
    }

    // Try to extract phone from body
    if (bodyEl) {
      const phoneMatch = bodyEl.textContent.match(/(\+?[\d\s\-().]{10,15})/);
      if (phoneMatch) data.phone = phoneMatch[0].trim();
    }

    // Try to extract LinkedIn URL from body
    if (bodyEl) {
      const linkedinMatch = bodyEl.innerHTML.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[^\s"<]+/);
      if (linkedinMatch) data.linkedinUrl = linkedinMatch[0];
    }

    return data;
  }

  function injectCaptureButton() {
    if (captureButton) removeCaptureButton();

    // Find the email toolbar area
    const toolbar = document.querySelector('.ade .aDP, .iH > div');

    captureButton = document.createElement('button');
    captureButton.id = 'wharf-gmail-capture-btn';
    captureButton.className = 'wharf-btn wharf-btn-gmail';
    captureButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>Add to Wharf</span>
    `;
    captureButton.addEventListener('click', handleGmailCapture);

    if (toolbar) {
      toolbar.appendChild(captureButton);
    } else {
      // Floating fallback
      captureButton.className = 'wharf-btn wharf-btn-floating wharf-btn-gmail-float';
      document.body.appendChild(captureButton);
    }
  }

  function removeCaptureButton() {
    if (captureButton) {
      captureButton.remove();
      captureButton = null;
    }
  }

  async function handleGmailCapture() {
    if (!currentEmailData || !currentEmailData.senderName) {
      showToast('error', 'Could not extract sender information');
      return;
    }

    const btn = captureButton;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<span>Capturing...</span>`;
    btn.disabled = true;

    try {
      const candidateData = {
        name: currentEmailData.senderName,
        email: currentEmailData.senderEmail || null,
        headline: currentEmailData.subject ? `Re: ${currentEmailData.subject}` : null,
        linkedin_url: currentEmailData.linkedinUrl || null,
        about: currentEmailData.bodySnippet || null,
        source: 'Gmail',
        capturedFrom: location.href,
        notes: `Captured from Gmail. Subject: "${currentEmailData.subject}"`,
      };

      const response = await chrome.runtime.sendMessage({
        action: 'CAPTURE_CANDIDATE',
        data: candidateData,
      });

      if (response.success) {
        btn.innerHTML = `<span>Added!</span>`;
        btn.classList.add('wharf-btn-success');
        showToast('success', `${candidateData.name} added to your pipeline`);
      } else if (response.duplicate) {
        btn.innerHTML = `<span>Already exists</span>`;
        btn.classList.add('wharf-btn-warning');
        showToast('warning', `${candidateData.name} is already in your pipeline`);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      btn.innerHTML = originalHTML;
      showToast('error', error.message);
    } finally {
      btn.disabled = false;
      setTimeout(() => {
        if (btn.classList.contains('wharf-btn-success') || btn.classList.contains('wharf-btn-warning')) {
          btn.innerHTML = originalHTML;
          btn.classList.remove('wharf-btn-success', 'wharf-btn-warning');
        }
      }, 4000);
    }
  }

  function showToast(type, message) {
    const existing = document.querySelector('.wharf-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `wharf-toast wharf-toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('wharf-toast-visible'));
    setTimeout(() => {
      toast.classList.remove('wharf-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
