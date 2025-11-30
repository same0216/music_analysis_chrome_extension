// Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Music BPM & Key Analyzer extension installed');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    handleTabCapture(sender.tab.id, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

async function handleTabCapture(tabId, sendResponse) {
  try {
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });

    if (stream) {
      sendResponse({ success: true, stream: stream });
    } else {
      sendResponse({ success: false, error: 'Could not capture tab audio' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Listen for tab updates to detect audio playing
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.audible !== undefined) {
    // Tab audio state changed
    console.log(`Tab ${tabId} audio: ${changeInfo.audible ? 'playing' : 'stopped'}`);
  }
});
