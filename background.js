/**
 * バックグラウンドサービスワーカー
 * @file background.js
 * @description Chrome拡張機能のバックグラウンドプロセスを管理します
 */

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('Music BPM & Key Analyzer拡張機能がインストールされました');
});

// コンテンツスクリプトまたはポップアップからのメッセージを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    handleTabCapture(sender.tab.id, sendResponse);
    return true; // 非同期レスポンスのためにメッセージチャネルを開いたままにする
  }
});

/**
 * タブの音声キャプチャを処理する
 * @async
 * @function handleTabCapture
 * @param {number} tabId - キャプチャするタブのID
 * @param {Function} sendResponse - レスポンスを送信する関数
 * @description 指定されたタブの音声をキャプチャします
 */
async function handleTabCapture(tabId, sendResponse) {
  try {
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });

    if (stream) {
      sendResponse({ success: true, stream: stream });
    } else {
      sendResponse({ success: false, error: 'タブの音声をキャプチャできませんでした' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// 音声再生を検出するためにタブの更新をリッスン
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.audible !== undefined) {
    // タブの音声状態が変更された
    console.log(`Tab ${tabId} 音声: ${changeInfo.audible ? '再生中' : '停止'}`);
  }
});
