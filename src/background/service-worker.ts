/**
 * Background Service Worker for Chromium Manifest V3.
 * Configures side panel behavior and handles fallback navigation.
 * Zero DOM scraping, zero page injection.
 */

// Enable openPanelOnActionClick if supported by browser (Brave / Chrome 116+)
if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn('[ServiceWorker] Could not set panel behavior:', error));
}

// Fallback listener for action click if setPanelBehavior is unsupported
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function' && tab.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      return;
    } catch (err) {
      console.warn('[ServiceWorker] sidePanel.open failed, falling back to full tab:', err);
    }
  }

  // Open full tab dashboard as fallback
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard.html'),
  });
});

