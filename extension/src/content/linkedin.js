// ═══════════════════════════════════════════════════
// TALENT WHARF - LinkedIn Content Script
// Extracts candidate data from LinkedIn profile pages
// ═══════════════════════════════════════════════════

(function() {
  'use strict';

  // Prevent double injection
  if (window.__wharfLinkedInLoaded) return;
  window.__wharfLinkedInLoaded = true;

  let captureButton = null;
  let isCapturing = false;

  // ── Wait for profile to load then inject button ──
  function init() {
    // LinkedIn is an SPA - watch for URL changes
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (isProfilePage()) {
          setTimeout(injectCaptureButton, 1500);
        } else {
          removeCaptureButton();
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    if (isProfilePage()) {
      setTimeout(injectCaptureButton, 2000);
    }
  }

  function isProfilePage() {
    return /linkedin\.com\/in\/[^/]+/.test(location.href);
  }

  // ── Extract Candidate Data ──
  function extractProfileData() {
    const data = {
      name: '',
      headline: '',
      about: '',
      email: null,
      linkedinUrl: location.href.split('?')[0],
      location: '',
      skills: [],
      experience: [],
      source: 'LinkedIn',
      capturedFrom: location.href,
    };

    // Name
    const nameEl = document.querySelector('h1.text-heading-xlarge') ||
                   document.querySelector('.pv-top-card--list li:first-child') ||
                   document.querySelector('h1');
    if (nameEl) {
      data.name = nameEl.textContent.trim();
    }

    // Headline
    const headlineEl = document.querySelector('.text-body-medium.break-words') ||
                       document.querySelector('.pv-top-card--list + .text-body-medium') ||
                       document.querySelector('[data-generated-suggestion-target]');
    if (headlineEl) {
      data.headline = headlineEl.textContent.trim();
    }

    // Location
    const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words') ||
                       document.querySelector('.pv-top-card--list.pv-top-card--list-bullet span');
    if (locationEl) {
      data.location = locationEl.textContent.trim();
    }

    // About section
    const aboutSection = document.querySelector('#about ~ .display-flex .pv-shared-text-with-see-more span[aria-hidden="true"]') ||
                         document.querySelector('.pv-about__summary-text .inline-show-more-text') ||
                         document.querySelector('#about + .pvs-list__outer-container .visually-hidden');
    if (aboutSection) {
      data.about = aboutSection.textContent.trim().substring(0, 2000);
    }

    // Skills
    const skillElements = document.querySelectorAll(
      '.pv-skill-category-entity__name-text, ' +
      '.hoverable-link-text span[aria-hidden="true"], ' +
      '[data-field="skill_card_skill_topic"] span'
    );
    const skillSet = new Set();
    skillElements.forEach(el => {
      const skill = el.textContent.trim();
      if (skill && skill.length < 100) {
        skillSet.add(skill);
      }
    });
    data.skills = [...skillSet].slice(0, 30);

    // Experience
    const experienceItems = document.querySelectorAll(
      '#experience ~ .pvs-list__outer-container .pvs-list__paged-list-item, ' +
      '.pv-experience-section__list-item'
    );
    experienceItems.forEach(item => {
      const titleEl = item.querySelector('.t-bold span[aria-hidden="true"]') ||
                      item.querySelector('.pv-entity__summary-info h3');
      const companyEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]') ||
                        item.querySelector('.pv-entity__secondary-title');
      const durationEl = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');

      if (titleEl) {
        data.experience.push({
          title: titleEl.textContent.trim(),
          company: companyEl ? companyEl.textContent.trim() : '',
          duration: durationEl ? durationEl.textContent.trim() : '',
        });
      }
    });
    data.experience = data.experience.slice(0, 10);

    return data;
  }

  // ── Inject Capture Button ──
  function injectCaptureButton() {
    if (captureButton) removeCaptureButton();

    // Find the action buttons area
    const actionsContainer = document.querySelector('.pvs-profile-actions') ||
                              document.querySelector('.pv-top-card-v2-ctas') ||
                              document.querySelector('.ph5.pb5') ||
                              document.querySelector('.mt2');

    if (!actionsContainer) {
      // Fallback: create floating button
      createFloatingButton();
      return;
    }

    captureButton = document.createElement('button');
    captureButton.id = 'wharf-capture-btn';
    captureButton.className = 'wharf-btn wharf-btn-primary';
    captureButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>Add to Wharf</span>
    `;
    captureButton.addEventListener('click', handleCapture);

    actionsContainer.appendChild(captureButton);
  }

  function createFloatingButton() {
    captureButton = document.createElement('button');
    captureButton.id = 'wharf-capture-btn';
    captureButton.className = 'wharf-btn wharf-btn-floating';
    captureButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>Add to Wharf</span>
    `;
    captureButton.addEventListener('click', handleCapture);
    document.body.appendChild(captureButton);
  }

  function removeCaptureButton() {
    if (captureButton) {
      captureButton.remove();
      captureButton = null;
    }
  }

  // ── Handle Capture ──
  async function handleCapture() {
    if (isCapturing) return;
    isCapturing = true;

    const btn = captureButton;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
      <svg class="wharf-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span>Capturing...</span>
    `;
    btn.disabled = true;

    try {
      const profileData = extractProfileData();

      if (!profileData.name) {
        throw new Error('Could not extract candidate name from page');
      }

      const response = await chrome.runtime.sendMessage({
        action: 'CAPTURE_CANDIDATE',
        data: profileData,
      });

      if (response.success) {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>Added to Wharf</span>
        `;
        btn.classList.add('wharf-btn-success');
        showToast('success', `${profileData.name} added to your pipeline`);
      } else if (response.duplicate) {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>Already exists</span>
        `;
        btn.classList.add('wharf-btn-warning');
        showToast('warning', `${profileData.name} is already in your pipeline`);
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      btn.innerHTML = originalHTML;
      btn.classList.add('wharf-btn-error');
      showToast('error', error.message);

      // Reset error state after 3s
      setTimeout(() => {
        btn.classList.remove('wharf-btn-error');
      }, 3000);
    } finally {
      btn.disabled = false;
      isCapturing = false;

      // Reset button after 5s on success/warning
      setTimeout(() => {
        if (btn.classList.contains('wharf-btn-success') || btn.classList.contains('wharf-btn-warning')) {
          btn.innerHTML = originalHTML;
          btn.classList.remove('wharf-btn-success', 'wharf-btn-warning');
        }
      }, 5000);
    }
  }

  // ── Toast Notification ──
  function showToast(type, message) {
    const existing = document.querySelector('.wharf-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `wharf-toast wharf-toast-${type}`;

    const icons = {
      success: '<path d="M20 6L9 17l-5-5"/>',
      error: '<path d="M18 6L6 18M6 6l12 12"/>',
      warning: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    };

    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${icons[type]}
      </svg>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('wharf-toast-visible'));

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('wharf-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ── Start ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
