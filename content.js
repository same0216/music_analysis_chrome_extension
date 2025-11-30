/**
 * コンテンツスクリプト
 * @file content.js
 * @description すべてのウェブページで実行され、メディア要素を検出します
 */

// コンテンツスクリプト - 全ページで実行
console.log('Music Analyzerコンテンツスクリプトが読み込まれました');

/**
 * ページ上の音声/動画要素を検出する
 * @function detectMediaElements
 * @returns {boolean} メディア要素が存在する場合はtrue
 * @description ページ内のaudioタグとvideoタグの有無を確認します
 */
function detectMediaElements() {
  const audioElements = document.querySelectorAll('audio, video');
  return audioElements.length > 0;
}

// メディアが検出されたときにバックグラウンドスクリプトにメッセージを送信
if (detectMediaElements()) {
  chrome.runtime.sendMessage({
    action: 'mediaDetected',
    hasMedia: true
  });
}

// 動的に追加されるメディア要素を監視
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

// ポップアップからのメッセージをリッスン
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkMedia') {
    sendResponse({ hasMedia: detectMediaElements() });
  }
});
