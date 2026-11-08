# SceneForge
**v1.0.0** — Assisted bulk-generation workflow and queue manager for cinematic Image Prompt JSONs.

---

## Key Features

- **Flexible Image Prompt JSON Schema**: Accepts project-specific fields (`image_number`, `episode`, `part`, `scene`, `title`, `duration_seconds`, `aspect_ratio`, `resolution`, `production`, `reference_images`, `location`, `exact_character_count`, `characters_visible`).
- **Verbatim Source Preservation**: Never rewrites, reformats, or re-serializes prompt text. Clipboard copying is guaranteed 100% byte-for-byte identical to source JSON.
- **Alphanumeric Scene Sorting**: Natural sorting for alphanumeric scenes (e.g., `1`, `2`, `2A`, `2B`, `10`, `68A`, `68AD`, `70`).
- **Strictly Decoupled Statuses**: `Queued` → `Copied` → `Submitted` → `Awaiting Review` → `Approved` / `Regeneration Required`. Copying is never confused with submission.
- **Local Persistence & Live Sync**: Authoritative IndexedDB (Dexie.js) storage for metadata, reference assets, and high-res results. Real-time `BroadcastChannel` synchronization between Side Panel HUD and Full Dashboard.
- **Direct Clipboard Image Binary Copy**: 1-click "Copy Image" for matched character/location reference assets so you can paste (`Ctrl+V`) reference images directly into ChatGPT prompt boxes without using the file explorer.
- **Format-Preserving Deliverable Export**: Packages batch manifest JSON and results formatted as:  
  `[Project]_Ep[XX]_P[YY]_Sc[AlphanumericID]_v[AttemptNum].[ext]` (preserving PNG, JPEG, and WebP).
- **Database Backup & Disaster Recovery**: Single-click full JSON database export and backup restore.
- **Zero Host Permissions & Strict Privacy**: Zero scraping, no content scripts, no credentials touched, no undocumented APIs.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + ↓` / `Alt + →` | Select **Next Scene** in queue |
| `Alt + ↑` / `Alt + ←` | Select **Previous Scene** in queue |
| `Alt + C` | **Copy Current Scene Prompt JSON** verbatim to clipboard |

---

## Installation in Brave

1. Open Brave and go to `brave://extensions`.
2. Enable **Developer mode** in the top-right toggle.
3. Click **Load unpacked**.
4. Select:  
   `C:\Projects\SceneForge\dist`
5. Pin the extension to your toolbar.

---

## Development

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Build production unpacked extension
npm run build
```

