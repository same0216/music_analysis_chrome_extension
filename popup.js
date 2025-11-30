// Popup UI Controller
let analyzer = null;
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

  async function startAnalysis() {
    try {
      isAnalyzing = true;
      updateUI('analyzing');
      hideError();
      hideResults();

      // Request tab capture permission
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Start tab audio capture
      chrome.tabCapture.capture({ audio: true }, async (stream) => {
        if (!stream) {
          throw new Error('Could not capture audio. Make sure audio is playing in the tab.');
        }

        try {
          analyzer = new AudioAnalyzer();
          await initializeAnalyzer(stream);

          statusText.textContent = 'Analyzing BPM...';
          const bpm = await analyzer.analyzeBPM(8000);

          statusText.textContent = 'Analyzing musical key...';
          const keyData = await analyzer.analyzeKey();

          displayResults(bpm, keyData);
          updateUI('complete');

          // Stop the stream after analysis
          stream.getTracks().forEach(track => track.stop());

        } catch (error) {
          console.error('Analysis error:', error);
          showError(error.message);
          updateUI('error');
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }

        isAnalyzing = false;
      });

    } catch (error) {
      console.error('Error:', error);
      showError(error.message);
      updateUI('error');
      isAnalyzing = false;
    }
  }

  async function initializeAnalyzer(stream) {
    const audioContext = new AudioContext();
    analyzer.audioContext = audioContext;
    analyzer.analyser = audioContext.createAnalyser();
    analyzer.analyser.fftSize = 8192;
    analyzer.analyser.smoothingTimeConstant = 0.8;
    analyzer.source = audioContext.createMediaStreamSource(stream);
    analyzer.source.connect(analyzer.analyser);

    // Start visualizer
    startVisualizer();
  }

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

  function stopAnalysis() {
    isAnalyzing = false;
    if (analyzer) {
      analyzer.cleanup();
      analyzer = null;
    }
    updateUI('ready');
  }

  function updateUI(state) {
    const btnIcon = analyzeBtn.querySelector('.btn-icon');
    const btnText = analyzeBtn.querySelector('.btn-text');

    statusIndicator.classList.remove('analyzing', 'error');
    analyzeBtn.classList.remove('analyzing');

    switch (state) {
      case 'analyzing':
        statusIndicator.classList.add('analyzing');
        analyzeBtn.classList.add('analyzing');
        statusText.textContent = 'Capturing audio...';
        btnIcon.textContent = '⏹';
        btnText.textContent = 'Stop Analysis';
        break;
      case 'complete':
        statusText.textContent = 'Analysis complete';
        btnIcon.textContent = '▶';
        btnText.textContent = 'Analyze Again';
        break;
      case 'error':
        statusIndicator.classList.add('error');
        statusText.textContent = 'Analysis failed';
        btnIcon.textContent = '▶';
        btnText.textContent = 'Try Again';
        break;
      default: // ready
        statusText.textContent = 'Ready to analyze';
        btnIcon.textContent = '▶';
        btnText.textContent = 'Start Analysis';
    }
  }

  function displayResults(bpm, keyData) {
    document.getElementById('bpmValue').textContent = bpm;
    document.getElementById('keyValue').textContent = keyData.camelot;
    document.getElementById('musicalKey').textContent = keyData.fullName;
    document.getElementById('mode').textContent = keyData.mode.charAt(0).toUpperCase() + keyData.mode.slice(1);

    resultsDiv.style.display = 'block';

    // Animate the values
    animateValue('bpmValue', 0, bpm, 1000);
  }

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

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  function hideError() {
    errorDiv.style.display = 'none';
  }

  function hideResults() {
    resultsDiv.style.display = 'none';
    visualizerDiv.style.display = 'none';
  }
});
