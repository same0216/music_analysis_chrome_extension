/**
 * BPMとキー検出のためのオーディオアナライザークラス
 * @class AudioAnalyzer
 * @description タブの音声をキャプチャして、BPM（テンポ）と音楽キーを分析します
 */
class AudioAnalyzer {
  /**
   * AudioAnalyzerのコンストラクタ
   * @constructor
   */
  constructor() {
    /** @type {AudioContext|null} Web Audio APIのオーディオコンテキスト */
    this.audioContext = null;
    /** @type {AnalyserNode|null} 音声分析用のアナライザーノード */
    this.analyser = null;
    /** @type {MediaStreamAudioSourceNode|null} メディアストリームのソースノード */
    this.source = null;
  }

  /**
   * Camelotホイールのマッピング
   * @static
   * @type {Object.<string, string>}
   * @description 音楽キー（C major等）からCamelot記法（8B等）へのマッピング
   */
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

  /**
   * 音名の配列
   * @static
   * @type {string[]}
   * @description C（ド）からB（シ）までの12音の配列
   */
  static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /**
   * タブの音声をキャプチャする
   * @async
   * @returns {Promise<boolean>} キャプチャ成功時はtrue
   * @throws {Error} 音声キャプチャに失敗した場合
   * @description Chrome Tab Capture APIを使用してタブの音声をキャプチャし、AudioContextに接続します
   */
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
      console.error('オーディオキャプチャエラー:', error);
      throw new Error('タブの音声をキャプチャできませんでした。音声が再生されていることを確認してください。');
    }
  }

  /**
   * タブストリームIDを取得する
   * @async
   * @returns {Promise<string>} ストリームID
   * @throws {Error} タブキャプチャに失敗した場合
   * @description Chrome Tab Capture APIからストリームIDを取得します
   */
  async getTabStreamId() {
    return new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true }, (stream) => {
        if (stream) {
          resolve(stream.id);
        } else {
          reject(new Error('タブのキャプチャに失敗しました'));
        }
      });
    });
  }

  /**
   * BPM（テンポ）を分析する
   * @async
   * @param {number} [duration=10000] - 分析時間（ミリ秒）デフォルトは10秒
   * @returns {Promise<number>} 検出されたBPM値（整数）
   * @throws {Error} アナライザーが初期化されていない場合
   * @description RMSエネルギーのピーク検出アルゴリズムを使用してBPMを計算します
   */
  async analyzeBPM(duration = 10000) {
    if (!this.analyser) {
      throw new Error('オーディオアナライザーが初期化されていません');
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

          // RMSエネルギーを計算
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

  /**
   * サンプルデータからBPMを計算する
   * @param {number[]} samples - RMSエネルギーのサンプル配列
   * @param {number} sampleRate - オーディオのサンプルレート
   * @returns {number} 計算されたBPM値
   * @description ピーク検出アルゴリズムを使用してサンプルからBPMを算出します
   * ピーク間の中央値間隔からBPMを計算し、60-180の範囲に正規化します
   */
  calculateBPMFromSamples(samples, sampleRate) {
    // ピーク検出アルゴリズム
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
      return 120; // 検出失敗時のデフォルトBPM
    }

    // ピーク間の間隔を計算
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // 中央値の間隔を取得
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    // BPMに変換（サンプルは約60fpsで収集される）
    const framesPerSecond = 60;
    const secondsPerBeat = medianInterval / framesPerSecond;
    const bpm = 60 / secondsPerBeat;

    // BPMを妥当な範囲(60-180)に収める
    if (bpm < 60) return bpm * 2;
    if (bpm > 180) return bpm / 2;

    return bpm;
  }

  /**
   * ピーク検出のための閾値を計算する
   * @param {number[]} samples - サンプルデータの配列
   * @returns {number} 閾値
   * @description 平均値と標準偏差を使用して、ピーク検出のための閾値を計算します
   */
  calculateThreshold(samples) {
    const sum = samples.reduce((a, b) => a + b, 0);
    const mean = sum / samples.length;
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    return mean + stdDev * 1.5;
  }

  /**
   * 音楽キーを分析する
   * @async
   * @returns {Promise<{key: string, mode: string, camelot: string, fullName: string}>} キー情報オブジェクト
   * @returns {string} key - 音名（C, D, E等）
   * @returns {string} mode - モード（major または minor）
   * @returns {string} camelot - Camelot記法（8B, 5A等）
   * @returns {string} fullName - フルネーム（C major, A minor等）
   * @throws {Error} アナライザーが初期化されていない場合
   * @description Krumhansl-Schmucklerアルゴリズムを使用して音楽キーを検出します
   */
  async analyzeKey() {
    if (!this.analyser) {
      throw new Error('オーディオアナライザーが初期化されていません');
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    // 周波数データを収集
    this.analyser.getFloatFrequencyData(dataArray);

    // クロマグラムを計算（12ビンのピッチクラスプロファイル）
    const chromagram = this.calculateChromagram(dataArray);

    // ピッチクラスプロファイルを使用してキーを検出
    const keyResult = this.detectKeyFromChromagram(chromagram);

    return keyResult;
  }

  /**
   * クロマグラムを計算する
   * @param {Float32Array} frequencyData - FFT周波数データ
   * @returns {number[]} 12ビンのクロマグラム配列（0-11: C-B）
   * @description 周波数データから12音のピッチクラスプロファイルを生成します
   * 各周波数ビンを対応するピッチクラスにマッピングし、正規化します
   */
  calculateChromagram(frequencyData) {
    const chromagram = new Array(12).fill(0);
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / (this.analyser.fftSize * 2);

    // 周波数ビンをピッチクラスにマッピング
    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = i * binSize;
      if (frequency < 60 || frequency > 4000) continue; // 音楽的な範囲に焦点を当てる

      const magnitude = Math.pow(10, frequencyData[i] / 20); // dBから変換
      const pitchClass = this.frequencyToPitchClass(frequency);
      chromagram[pitchClass] += magnitude;
    }

    // 正規化
    const max = Math.max(...chromagram);
    return chromagram.map(val => max > 0 ? val / max : 0);
  }

  /**
   * 周波数をピッチクラスに変換する
   * @param {number} frequency - 周波数（Hz）
   * @returns {number} ピッチクラス（0-11: C-B）
   * @description 周波数をMIDIノート番号に変換し、12で割った余りでピッチクラスを取得します
   */
  frequencyToPitchClass(frequency) {
    // 周波数をMIDIノート番号に変換
    const midiNote = 12 * Math.log2(frequency / 440) + 69;
    // ピッチクラス(0-11)を取得
    return Math.round(midiNote) % 12;
  }

  /**
   * クロマグラムから音楽キーを検出する
   * @param {number[]} chromagram - 12ビンのクロマグラム配列
   * @returns {{key: string, mode: string, camelot: string, fullName: string}} キー情報
   * @description Krumhansl-Schmucklerキー検出アルゴリズムを使用
   * 24個の可能なキー（12メジャー + 12マイナー）を試して、最も相関の高いキーを選択します
   */
  detectKeyFromChromagram(chromagram) {
    // Krumhansl-Schmucklerキー検出アルゴリズム
    // メジャーとマイナーのキープロファイル
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

    let bestCorrelation = -Infinity;
    let bestKey = 0;
    let bestMode = 'major';

    // 24個のキー（12メジャー + 12マイナー）を試す
    for (let tonic = 0; tonic < 12; tonic++) {
      // メジャーキー
      const majorCorr = this.calculateCorrelation(chromagram, majorProfile, tonic);
      if (majorCorr > bestCorrelation) {
        bestCorrelation = majorCorr;
        bestKey = tonic;
        bestMode = 'major';
      }

      // マイナーキー
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

  /**
   * クロマグラムとキープロファイルの相関を計算する
   * @param {number[]} chromagram - 12ビンのクロマグラム配列
   * @param {number[]} profile - メジャーまたはマイナーのキープロファイル
   * @param {number} rotation - 転回位置（0-11）
   * @returns {number} 相関値
   * @description 2つのベクトルの内積を計算して相関を求めます
   */
  calculateCorrelation(chromagram, profile, rotation) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const chromaIndex = (i + rotation) % 12;
      sum += chromagram[chromaIndex] * profile[i];
    }
    return sum;
  }

  /**
   * リソースをクリーンアップする
   * @description AudioContextとソースノードを切断・クローズしてリソースを解放します
   */
  cleanup() {
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// グローバルに利用可能にする
window.AudioAnalyzer = AudioAnalyzer;
