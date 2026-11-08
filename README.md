# SceneForge PromptPad
**v1.0.0** — A lightweight, persistent notepad for saving, editing, organizing, and instantly copying AI prompts and reusable text.

![SceneForge PromptPad](logo.png)

---

## 1. What PromptPad Does

**SceneForge PromptPad** is a fast, offline, persistent scratchpad and prompt manager built specifically for **Brave Browser** (Manifest V3).

It lives in your browser's **Side Panel** right next to **ChatGPT, Grok, Claude, Midjourney, YouTube**, or any web application.

### Core Workflow:
```text
Write / Paste Prompt ──> Autosaved to Local Storage ──> Select via Dropdown or [<] [>] ──> 1-Click Copy Verbatim
```

---

## 2. Key Features

- **Dropdown Selector & Previous/Next Navigation:**
  - Flip between prompts using the large `<` and `>` arrow buttons, or click the dropdown selector to jump directly to any prompt.
  - Optimized for narrow browser side panels (no awkward horizontal scrollbars).
- **Persistent Copy Toolbar Above Editor:**
  - A prominent, high-contrast **Copy** button sits right above the text editor.
  - Copies text verbatim (preserving all whitespace, indentation, newlines, quotation marks, and complex JSON structures).
  - Provides a green **"Copied!"** visual confirmation for 2 seconds.
- **Autosave on Keystroke:**
  - Automatically saves text while you type.
  - Zero risk of losing work when switching tabs, closing the panel, or restarting Brave.
- **Dual-Pane Full Dashboard Workspace:**
  - Click the **Maximize** button to open the full-tab writing workspace (`dashboard.html`) with a searchable sidebar and expanded canvas.
  - Real-time synchronization between the side panel and the dashboard tab via `BroadcastChannel` and storage events.
- **Backup & Restore (JSON Export / Import):**
  - Download all your notes as a local `.json` backup file (`PromptPad_Backup_YYYY-MM-DD.json`).
  - Restore notes anytime by uploading a previously saved backup file.
- **100% Client-Side & Offline:**
  - Zero API keys required.
  - Zero external network requests.
  - Minimal permissions (`sidePanel`, `storage`, `unlimitedStorage`, `clipboardWrite`, `clipboardRead`).

---

## 3. Installation Guide (Brave Browser)

1. Open Brave and navigate to:
   ```text
   brave://extensions
   ```
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the build directory:
   ```text
   C:\Projects\SceneForge\dist
   ```
5. Click **Select Folder**. **SceneForge PromptPad** is now installed and active!

---

## 4. How to Use PromptPad

### Selecting and Switching Notes
* Click the **Dropdown Selector** at the top to pick any saved prompt from the list.
* Click the large **Previous (`<`)** or **Next (`>`)** arrow buttons to cycle forwards and backwards through your prompts.

### Creating and Renaming Notes
* **New Note:** Click the **`+ New`** button in the persistent toolbar above the editor (or the `+` button in the header).
* **Rename Note:** Click the **`Rename`** button in the toolbar, edit the title, and press `Enter` or click `Save`.

### Copying to Clipboard
* Click the **Copy** button immediately above the editor.
* The entire content of the active prompt is copied to your clipboard verbatim, ready to paste into ChatGPT, Grok, or any other tool.

### Deleting and Clearing Notes
* **Delete Note:** Click the trash icon in the toolbar. A confirmation dialog prevents accidental deletions.
* **Clear Text:** Click the **Clear** button in the bottom utility bar to reset the text canvas.

### Backup and Restore
1. Click the **Download (Backup / Restore)** icon in the top header.
2. Click **Export** to download a `.json` backup of all your notes.
3. Click **Import** to select and restore a previously saved backup file.

---

## 5. How to Update Without Losing Data

Your prompts and notes are persistently stored in your browser's local storage (`sceneforge_promptpad_notes`). 

When updating extension code:
1. Rebuild the project:
   ```powershell
   npm run build
   ```
2. Open `brave://extensions`.
3. Click the **Reload** button on **SceneForge PromptPad**.
4. All existing notes, custom titles, and prompt texts are automatically preserved.

---

## 6. Project Architecture

```text
SceneForge/
├── public/
│   ├── manifest.json        # Chromium Manifest V3 configuration
│   ├── logo.png             # Official PromptPad branding
│   └── icons/               # Extension icons (16, 32, 48, 128)
├── src/
│   ├── background/
│   │   └── service-worker.ts # Configures side panel behavior on action click
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx   # Minimalist button component
│   │   │   └── Toast.tsx    # Toast notification system
│   │   └── promptpad/
│   │       ├── BackupModal.tsx        # JSON backup export/import modal
│   │       ├── ConfirmClearModal.tsx  # Safety prompt for clearing text
│   │       └── ConfirmDeleteModal.tsx # Safety prompt for deleting notes
│   ├── dashboard/
│   │   ├── main.tsx         # Dashboard entry point
│   │   └── DashboardApp.tsx # Full-tab desktop writing workspace
│   ├── sidepanel/
│   │   ├── main.tsx         # Side panel entry point
│   │   └── SidePanelApp.tsx # Brave side panel notepad interface
│   ├── services/
│   │   ├── noteManager.ts   # Core storage, sync, autosave, and verbatim copy
│   │   └── noteManager.test.ts # Vitest regression test suite
│   ├── styles/
│   │   └── globals.css      # Tailwind styling + subtle scrollbars
│   └── types/
│       └── note.ts          # Note interface and word/char counter
├── dashboard.html           # Full-tab workspace template
├── sidepanel.html           # Brave Side Panel template
└── package.json             # Minimal dependencies (React + Lucide)
```

---

## 7. Development & Testing Commands

```powershell
# Run unit tests
npm test

# Build production distribution into dist/
npm run build

# Package extension zip for release
npm run pack
```
