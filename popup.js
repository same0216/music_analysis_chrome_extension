/**
 * ポップアップUIコントローラー
 * @file popup.js
 * @description 拡張機能のポップアップUIを制御し、音声分析を管理します
 */

/** @type {AudioAnalyzer|null} オーディオアナライザーのインスタンス */
let analyzer = null;
/** @type {boolean} 分析中かどうかのフラグ */
let isAnalyzing = false;

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusIndicator = document.getElementById('status');
  const statusText = statusIndicator.querySelector('.status-text');
  const resultsDiv = document.getElementById('results');
  const errorDiv = document.getElementById('error');
  const visualizerDiv = document.getElementById('visualizer');

  analyzeBtn.addEventListener('click', async () => {
    if (isAnalyzing) {
      stopAnalysis();
      return;
    }

    await startAnalysis();
  });

  /**
   * 音声分析を開始する
   * @async
   * @function startAnalysis
   * @description タブの音声をキャプチャしてBPMとキーを分析します
   */
  async function startAnalysis() {
    try {
      isAnalyzing = true;
      updateUI('analyzing');
      hideError();
      hideResults();

      // タブキャプチャの許可をリクエスト
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // タブ音声のキャプチャを開始
      chrome.tabCapture.capture({ audio: true }, async (stream) => {
        if (!stream) {
          throw new Error('音声をキャプチャできませんでした。タブで音声が再生されていることを確認してください。');
        }

        try {
          analyzer = new AudioAnalyzer();
          await initializeAnalyzer(stream);

          statusText.textContent = 'BPMを分析中...';
          const bpm = await analyzer.analyzeBPM(8000);

          statusText.textContent = '音楽キーを分析中...';
          const keyData = await analyzer.analyzeKey();

          displayResults(bpm, keyData);
          updateUI('complete');

          // 分析後にストリームを停止
          stream.getTracks().forEach(track => track.stop());

        } catch (error) {
          console.error('分析エラー:', error);
          showError(error.message);
          updateUI('error');
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }

        isAnalyzing = false;
      });

    } catch (error) {
      console.error('エラー:', error);
      showError(error.message);
      updateUI('error');
      isAnalyzing = false;
    }
  }

  /**
   * アナライザーを初期化する
   * @async
   * @function initializeAnalyzer
   * @param {MediaStream} stream - キャプチャした音声ストリーム
   * @description AudioContextを作成し、ストリームをアナライザーに接続します
   */
  async function initializeAnalyzer(stream) {
    const audioContext = new AudioContext();
    analyzer.audioContext = audioContext;
    analyzer.analyser = audioContext.createAnalyser();
    analyzer.analyser.fftSize = 8192;
    analyzer.analyser.smoothingTimeConstant = 0.8;
    analyzer.source = audioContext.createMediaStreamSource(stream);
    analyzer.source.connect(analyzer.analyser);

    // ビジュアライザーを開始
    startVisualizer();
  }

  /**
   * 波形ビジュアライザーを開始する
   * @function startVisualizer
   * @description キャンバスに音声波形をリアルタイムで描画します
   */
  function startVisualizer() {
    const canvas = document.getElementById('waveform');
    const canvasCtx = canvas.getContext('2d');
    visualizerDiv.style.display = 'block';

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const bufferLength = analyzer.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!isAnalyzing || !analyzer) return;

      requestAnimationFrame(draw);
      analyzer.analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = '#f7fafc';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#667eea';
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    }

    draw();
  }

  /**
   * 分析を停止する
   * @function stopAnalysis
   * @description アナライザーをクリーンアップしてUIを初期状態に戻します
   */
  function stopAnalysis() {
    isAnalyzing = false;
    if (analyzer) {
      analyzer.cleanup();
      analyzer = null;
    }
    updateUI('ready');
  }

  /**
   * UIの状態を更新する
   * @function updateUI
   * @param {string} state - UI状態（'analyzing'|'complete'|'error'|'ready'）
   * @description 分析状態に応じてボタンとステータス表示を更新します
   */
  function updateUI(state) {
    const btnIcon = analyzeBtn.querySelector('.btn-icon');
    const btnText = analyzeBtn.querySelector('.btn-text');

    statusIndicator.classList.remove('analyzing', 'error');
    analyzeBtn.classList.remove('analyzing');

    switch (state) {
      case 'analyzing':
        statusIndicator.classList.add('analyzing');
        analyzeBtn.classList.add('analyzing');
        statusText.textContent = '音声をキャプチャ中...';
        btnIcon.textContent = '⏹';
        btnText.textContent = '分析を停止';
        break;
      case 'complete':
        statusText.textContent = '分析完了';
        btnIcon.textContent = '▶';
        btnText.textContent = '再度分析';
        break;
      case 'error':
        statusIndicator.classList.add('error');
        statusText.textContent = '分析失敗';
        btnIcon.textContent = '▶';
        btnText.textContent = '再試行';
        break;
      default: // ready
        statusText.textContent = '分析準備完了';
        btnIcon.textContent = '▶';
        btnText.textContent = '分析開始';
    }
  }

  /**
   * 分析結果を表示する
   * @function displayResults
   * @param {number} bpm - 検出されたBPM値
   * @param {{key: string, mode: string, camelot: string, fullName: string}} keyData - キー情報
   * @description BPMとキー情報を画面に表示し、アニメーションを適用します
   */
  function displayResults(bpm, keyData) {
    document.getElementById('bpmValue').textContent = bpm;
    document.getElementById('keyValue').textContent = keyData.camelot;
    document.getElementById('musicalKey').textContent = keyData.fullName;
    document.getElementById('mode').textContent = keyData.mode.charAt(0).toUpperCase() + keyData.mode.slice(1);

    resultsDiv.style.display = 'block';

    // 値をアニメーション
    animateValue('bpmValue', 0, bpm, 1000);
  }

  /**
   * 数値をアニメーション表示する
   * @function animateValue
   * @param {string} elementId - アニメーション対象の要素ID
   * @param {number} start - 開始値
   * @param {number} end - 終了値
   * @param {number} duration - アニメーション時間（ミリ秒）
   * @description 指定された要素の数値を滑らかにアニメーションします
   */
  function animateValue(elementId, start, end, duration) {
    const element = document.getElementById(elementId);
    const range = end - start;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + range * progress);
      element.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  /**
   * エラーメッセージを表示する
   * @function showError
   * @param {string} message - エラーメッセージ
   * @description エラーメッセージをユーザーに表示します
   */
  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  /**
   * エラーメッセージを非表示にする
   * @function hideError
   * @description エラー表示エリアを非表示にします
   */
  function hideError() {
    errorDiv.style.display = 'none';
  }

  /**
   * 結果表示を非表示にする
   * @function hideResults
   * @description 結果とビジュアライザーを非表示にします
   */
  function hideResults() {
    resultsDiv.style.display = 'none';
    visualizerDiv.style.display = 'none';
  }
});
