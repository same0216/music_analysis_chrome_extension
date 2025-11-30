# Music BPM & Key Analyzer Chrome Extension

A modern Chrome extension that analyzes the BPM (Beats Per Minute) and musical key of audio playing in your current browser tab.

## Features

- 🎵 **BPM Detection**: Automatically detects the tempo of music playing in your tab
- 🎹 **Key Detection**: Identifies the musical key using the Camelot Wheel notation (e.g., 8B, 5A)
- 🎨 **Modern UI**: Beautiful, gradient-based interface with smooth animations
- 📊 **Real-time Visualization**: Audio waveform visualization during analysis
- ⚡ **Fast Analysis**: Results in seconds using advanced audio processing algorithms

## Installation

1. Clone or download this repository
2. Add icon files to the `icons/` directory:
   - icon16.png (16x16)
   - icon48.png (48x48)
   - icon128.png (128x128)
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension directory
6. The extension icon should appear in your toolbar

## Usage

1. Navigate to a webpage with audio playing (YouTube, Spotify Web Player, SoundCloud, etc.)
2. Click the extension icon in your toolbar
3. Click "Start Analysis" button
4. Wait a few seconds while the extension analyzes the audio
5. View the BPM and musical key results

## Technical Details

### BPM Detection
The extension uses a peak detection algorithm that:
- Captures audio samples from the active tab
- Analyzes the RMS energy of the audio signal
- Detects peaks in the energy levels
- Calculates the median interval between peaks
- Converts to BPM with range normalization (60-180 BPM)

### Key Detection
The musical key is detected using:
- FFT (Fast Fourier Transform) analysis
- Chromagram calculation (12-bin pitch class profile)
- Krumhansl-Schmuckler key-finding algorithm
- Correlation with major and minor key profiles
- Camelot Wheel notation mapping

### Technology Stack
- **Manifest V3**: Latest Chrome extension format
- **Web Audio API**: For audio capture and analysis
- **Chrome Tab Capture API**: For capturing tab audio
- **Vanilla JavaScript**: No dependencies required
- **CSS3**: Modern gradients and animations

## Camelot Wheel Reference

The Camelot Wheel is a music notation system for harmonic mixing:

| Key | Camelot | Key | Camelot |
|-----|---------|-----|---------|
| C major | 8B | A minor | 8A |
| G major | 9B | E minor | 9A |
| D major | 10B | B minor | 10A |
| A major | 11B | F# minor | 11A |
| E major | 12B | C# minor | 12A |
| B major | 1B | G# minor | 1A |
| F# major | 2B | D# minor | 2A |
| Db major | 3B | Bb minor | 3A |
| Ab major | 4B | F minor | 4A |
| Eb major | 5B | C minor | 5A |
| Bb major | 6B | G minor | 6A |
| F major | 7B | D minor | 7A |

## Browser Compatibility

- Chrome 88+
- Edge 88+
- Other Chromium-based browsers with Manifest V3 support

## Permissions

The extension requires:
- `activeTab`: To access the current tab
- `tabCapture`: To capture audio from tabs
- `scripting`: To inject content scripts

## Limitations

- Only works with tabs that have audio playing
- Requires audio to be actively playing during analysis
- Best results with consistent, beat-driven music
- May not work with all websites due to audio restrictions

## Development

### File Structure
```
music_analysis_chrome_extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and UI controller
├── styles.css            # Modern styling
├── audio-analyzer.js     # BPM and key detection algorithms
├── background.js         # Background service worker
├── content.js            # Content script
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Testing
1. Test on various music streaming sites (YouTube, Spotify, SoundCloud)
2. Try different genres and tempos
3. Verify key detection accuracy with known songs
4. Check UI responsiveness and animations

## Future Enhancements

- [ ] History of analyzed tracks
- [ ] Export results to CSV/JSON
- [ ] Integration with music databases (Spotify API, etc.)
- [ ] Waveform analysis visualization
- [ ] Batch analysis of playlists
- [ ] Tempo adjustment controls

## License

MIT License - Feel free to use and modify as needed.

## Credits

Developed using:
- Krumhansl-Schmuckler key-finding algorithm
- Camelot Wheel harmonic mixing system
- Web Audio API specifications
