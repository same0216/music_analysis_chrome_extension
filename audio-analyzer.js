// Audio Analyzer for BPM and Key Detection
class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
  }

  // Camelot Wheel mapping
  static CAMELOT_WHEEL = {
    'C major': '8B', 'A minor': '8A',
    'G major': '9B', 'E minor': '9A',
    'D major': '10B', 'B minor': '10A',
    'A major': '11B', 'F# minor': '11A',
    'E major': '12B', 'C# minor': '12A',
    'B major': '1B', 'G# minor': '1A',
    'F# major': '2B', 'D# minor': '2A',
    'Db major': '3B', 'Bb minor': '3A',
    'Ab major': '4B', 'F minor': '4A',
    'Eb major': '5B', 'C minor': '5A',
    'Bb major': '6B', 'G minor': '6A',
    'F major': '7B', 'D minor': '7A'
  };

  static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  async captureTabAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: await this.getTabStreamId()
          }
        }
      });

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 8192;
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      return true;
    } catch (error) {
      console.error('Error capturing audio:', error);
      throw new Error('Could not capture tab audio. Make sure audio is playing.');
    }
  }

  async getTabStreamId() {
    return new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true }, (stream) => {
        if (stream) {
          resolve(stream.id);
        } else {
          reject(new Error('Failed to capture tab'));
        }
      });
    });
  }

  async analyzeBPM(duration = 10000) {
    if (!this.analyser) {
      throw new Error('Audio analyzer not initialized');
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const sampleRate = this.audioContext.sampleRate;
    const samples = [];
    const startTime = Date.now();

    return new Promise((resolve) => {
      const collectSamples = () => {
        if (Date.now() - startTime < duration) {
          this.analyser.getByteTimeDomainData(dataArray);

          // Calculate RMS energy
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / bufferLength);
          samples.push(rms);

          requestAnimationFrame(collectSamples);
        } else {
          const bpm = this.calculateBPMFromSamples(samples, sampleRate);
          resolve(Math.round(bpm));
        }
      };

      collectSamples();
    });
  }

  calculateBPMFromSamples(samples, sampleRate) {
    // Peak detection algorithm
    const peaks = [];
    const threshold = this.calculateThreshold(samples);

    for (let i = 1; i < samples.length - 1; i++) {
      if (samples[i] > threshold &&
          samples[i] > samples[i - 1] &&
          samples[i] > samples[i + 1]) {
        peaks.push(i);
      }
    }

    if (peaks.length < 2) {
      return 120; // Default BPM if detection fails
    }

    // Calculate intervals between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // Get median interval
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    // Convert to BPM (samples are collected at ~60fps)
    const framesPerSecond = 60;
    const secondsPerBeat = medianInterval / framesPerSecond;
    const bpm = 60 / secondsPerBeat;

    // Ensure BPM is in reasonable range (60-180)
    if (bpm < 60) return bpm * 2;
    if (bpm > 180) return bpm / 2;

    return bpm;
  }

  calculateThreshold(samples) {
    const sum = samples.reduce((a, b) => a + b, 0);
    const mean = sum / samples.length;
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    return mean + stdDev * 1.5;
  }

  async analyzeKey() {
    if (!this.analyser) {
      throw new Error('Audio analyzer not initialized');
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    // Collect frequency data
    this.analyser.getFloatFrequencyData(dataArray);

    // Calculate chromagram (12-bin pitch class profile)
    const chromagram = this.calculateChromagram(dataArray);

    // Detect key using pitch class profile
    const keyResult = this.detectKeyFromChromagram(chromagram);

    return keyResult;
  }

  calculateChromagram(frequencyData) {
    const chromagram = new Array(12).fill(0);
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / (this.analyser.fftSize * 2);

    // Map frequency bins to pitch classes
    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = i * binSize;
      if (frequency < 60 || frequency > 4000) continue; // Focus on musical range

      const magnitude = Math.pow(10, frequencyData[i] / 20); // Convert from dB
      const pitchClass = this.frequencyToPitchClass(frequency);
      chromagram[pitchClass] += magnitude;
    }

    // Normalize
    const max = Math.max(...chromagram);
    return chromagram.map(val => max > 0 ? val / max : 0);
  }

  frequencyToPitchClass(frequency) {
    // Convert frequency to MIDI note number
    const midiNote = 12 * Math.log2(frequency / 440) + 69;
    // Get pitch class (0-11)
    return Math.round(midiNote) % 12;
  }

  detectKeyFromChromagram(chromagram) {
    // Krumhansl-Schmuckler key-finding algorithm
    // Major and minor key profiles
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

    let bestCorrelation = -Infinity;
    let bestKey = 0;
    let bestMode = 'major';

    // Try all 24 keys (12 major + 12 minor)
    for (let tonic = 0; tonic < 12; tonic++) {
      // Major key
      const majorCorr = this.calculateCorrelation(chromagram, majorProfile, tonic);
      if (majorCorr > bestCorrelation) {
        bestCorrelation = majorCorr;
        bestKey = tonic;
        bestMode = 'major';
      }

      // Minor key
      const minorCorr = this.calculateCorrelation(chromagram, minorProfile, tonic);
      if (minorCorr > bestCorrelation) {
        bestCorrelation = minorCorr;
        bestKey = tonic;
        bestMode = 'minor';
      }
    }

    const noteName = AudioAnalyzer.NOTE_NAMES[bestKey];
    const keyName = `${noteName} ${bestMode}`;
    const camelot = AudioAnalyzer.CAMELOT_WHEEL[keyName] || '--';

    return {
      key: noteName,
      mode: bestMode,
      camelot: camelot,
      fullName: keyName
    };
  }

  calculateCorrelation(chromagram, profile, rotation) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const chromaIndex = (i + rotation) % 12;
      sum += chromagram[chromaIndex] * profile[i];
    }
    return sum;
  }

  cleanup() {
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Make it available globally
window.AudioAnalyzer = AudioAnalyzer;
