// Content Script - Runs on all pages
console.log('Music Analyzer content script loaded');

// Detect audio/video elements on the page
function detectMediaElements() {
  const audioElements = document.querySelectorAll('audio, video');
  return audioElements.length > 0;
}

// Send message to background script when media is detected
if (detectMediaElements()) {
  chrome.runtime.sendMessage({
    action: 'mediaDetected',
    hasMedia: true
  });
}

// Monitor for dynamically added media elements
const observer = new MutationObserver((mutations) => {
  if (detectMediaElements()) {
    chrome.runtime.sendMessage({
      action: 'mediaDetected',
      hasMedia: true
    });
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkMedia') {
    sendResponse({ hasMedia: detectMediaElements() });
  }
});
