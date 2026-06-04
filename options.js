/**
 * SKYCAST — options.js
 * Handles API key persistence for the settings page.
 * Uses the same Storage abstraction as popup.js to support both
 * Chrome extension context (chrome.storage.sync) and local dev (localStorage).
 */

const Storage = {
  get(key, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.get([key], result => callback(result[key] ?? null));
    } else {
      callback(localStorage.getItem(`skycast_${key}`));
    }
  },
  set(key, value, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set({ [key]: value }, () => callback?.());
    } else {
      localStorage.setItem(`skycast_${key}`, value);
      callback?.();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  const input     = document.getElementById('apiKeyInput');
  const saveBtn   = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMsg');

  // Pre-fill with the currently saved key (masked)
  Storage.get('apiKey', key => {
    if (key) input.value = key;
  });

  saveBtn.addEventListener('click', saveKey);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveKey();
  });

  function saveKey() {
    const key = input.value.trim();
    if (!key) {
      showStatus('Please paste a valid API key.', 'error');
      return;
    }
    Storage.set('apiKey', key, () => {
      showStatus('✓ API key saved!', 'success');
    });
  }

  function showStatus(message, type) {
    statusMsg.textContent = message;
    statusMsg.className   = `status-msg ${type}`;
    statusMsg.hidden      = false;
    if (type === 'success') {
      setTimeout(() => { statusMsg.hidden = true; }, 3000);
    }
  }
});
