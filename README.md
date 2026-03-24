# YallaType (WebExtension)

A Manifest V3 browser extension (Chrome, Edge, Firefox) that transliterates Arabizi (Latin) to Arabic in real time while typing.

## Features

- Real-time transliteration in:
  - `input`
  - `textarea`
  - `contenteditable` elements
- Incremental replacement of only the last typed token
- Cursor-friendly updates without rewriting the entire field
- Common Arabizi mappings (`3 -> ع`, `7 -> ح`, `9 -> ق`, `sh -> ش`, `kh -> خ`, `gh -> غ`)
- Whole-word transliteration examples (such as `salam -> سلام`)
- Popup UI for:
  - global enable/disable
  - per-site enable/disable
- Keyboard shortcut to toggle globally: `Alt+Shift+T`
- Skips password and unsupported input types
- Defensive skip mode for known complex editors (Google Docs, ProseMirror, CodeMirror, Slate, Lexical)

## Project Structure

- `manifest.json`
- `src/background/service-worker.js`
- `src/transliteration/mappings.js`
- `src/transliteration/engine.js`
- `src/content/content-script.js`
- `src/popup/popup.html`
- `src/popup/popup.css`
- `src/popup/popup.js`

## How It Works

1. Content script listens to `input`, `blur`, and composition events.
2. On word boundaries (space or punctuation) and on blur/composition commit, it extracts only the token before the caret.
3. The transliteration engine converts that token using:
   - whole-word map first
   - then ordered multi-character patterns
   - then single-character fallback mappings
4. Only the token range is replaced to preserve editing behavior.

## Load Locally

### Chrome / Edge

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Choose `manifest.json` from this project folder.

## Notes

- Mappings are intentionally simple and deterministic by default.
- Extend `src/transliteration/mappings.js` to add dialect-specific or phrase-level transliteration.
- For production publishing, add icons and a privacy policy as needed by store requirements.
