# SceneForge — Step-by-Step Walkthrough Guide

This walkthrough guides you through installing, configuring, and executing an assisted cinematic batch generation workflow using the **SceneForge Bulk Image Generator** extension in Brave.

---

## Table of Contents

1. [Installation & Setup](#1-installation--setup)
2. [Interface Overview: Side Panel vs. Full Dashboard](#2-interface-overview-side-panel-vs-full-dashboard)
3. [Step 1: Ingestion & Validation](#step-1-ingestion--validation)
4. [Step 2: Reference Image Mapping](#step-2-reference-image-mapping)
5. [Step 3: The Assisted Generation Loop (ChatGPT)](#step-3-the-assisted-generation-loop-chatgpt)
6. [Step 4: Review, Approval & Regeneration](#step-4-review-approval--regeneration)
7. [Step 5: Batch Manifest & ZIP Export](#step-5-batch-manifest--zip-export)
8. [Database Backup & Disaster Recovery](#database-backup--disaster-recovery)
9. [Keyboard Shortcuts Cheat Sheet](#keyboard-shortcuts-cheat-sheet)

---

## 1. Installation & Setup

1. Open **Brave** and navigate to `brave://extensions` (or `chrome://extensions` in Chrome/Edge).
2. Enable the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Browse to and select your build folder:
   ```text
   C:\Projects\SceneForge\dist
   ```
5. Click **Select Folder**. The extension **SceneForge Bulk Image Generator** will appear in your extensions list.
6. Click the extensions puzzle icon on the Brave toolbar and **pin** the SceneForge clapperboard icon for quick access.

---

## 2. Interface Overview: Side Panel vs. Full Dashboard

The extension provides two synchronized surfaces powered by a shared IndexedDB:

- **Side Panel HUD (`sidepanel.html`)**:
  - Docks natively to the right side of your active ChatGPT tab.
  - Designed for rapid copy-paste, reference checking, and drag-and-drop result ingestion.
  - Open by clicking the toolbar icon or choosing **Open side panel** from the extension menu.
- **Full-Tab Dashboard (`dashboard.html`)**:
  - Full-screen wide view for managing large multi-episode queues, mass reference folder ingestion, and batch auditing.
  - Open by clicking the **Maximize** button in the Side Panel header, or navigating directly to the dashboard URL.

---

## 3. Step 1: Ingestion & Validation

You can import prompts from single `.json` files, multiple files at once, or paste a batch.

### Walkthrough with Sample Prompts:
1. Open the Side Panel HUD or Dashboard.
2. Click **Import Prompts** (`+` button).
3. Choose either:
   - **Upload JSON Files**: Drag and drop [`sample-prompts.json`](./sample-prompts.json) (or multiple scene `.json` files).
   - **Paste Batch JSON**: Paste raw JSON object or array.
4. The parser validates the structure:
   - Alphanumeric scene identifiers (`68A`, `68AD`, `20B`) are extracted and organized.
   - Cinematic format requirements (strict 9:16 vertical, 1080×1920, ARRI ALEXA 35, Cooke S4/i) are verified. Non-matching fields are tagged with non-blocking diagnostic notices.
   - Original prompt JSON text is preserved **100% verbatim**.
5. Click **Add Scene(s) to Queue**.

---

## 4. Step 2: Reference Image Mapping

Prompts with `reference_images`, `character_references`, or `location_references` automatically populate a visual checklist for each scene.

1. Select a scene in the queue (e.g., `Scene 68AD`).
2. Notice the **Required Reference Images** checklist:
   - Example: `Char_Mateo_Portrait.png`, `Char_Elena_Portrait.png`, `Loc_Int_SanAgustin_Courtyard.jpg`.
   - Items initially show yellow **Unmapped** badges.
3. Click **Map Files** on the scene checklist (or click **Map Reference Assets** in the Dashboard header to select an entire folder of assets).
4. Select your local reference images from disk (for immediate testing, you can select the files inside [`sample-references/`](./sample-references/)).
5. The extension stores the image binaries in IndexedDB and matches them to scenes by filename:
   - Unmapped badges turn into green **Ready** badges.
   - High-res thumbnails render next to each character and location name.
6. **Time-Saving Feature — Direct Clipboard Image Binary Copy**:
   - Instead of looking up files on disk to upload to ChatGPT, click **Copy Image** on any matched reference badge.
   - The extension writes the raw PNG binary to your system clipboard.
   - In ChatGPT, simply press <kbd>Ctrl</kbd>+<kbd>V</kbd> to attach the reference image directly.

---

## 5. Step 3: The Assisted Generation Loop (ChatGPT)

Follow this assisted human-in-the-loop workflow:

```text
Select Scene ──> Check References ──> Copy Prompt JSON ──> Paste & Run in ChatGPT ──> Drop Result Image
```

1. Click **Open ChatGPT** in the extension header to launch or focus `chatgpt.com` beside the HUD.
2. In the HUD, click **Copy Prompt JSON** (or press <kbd>Alt</kbd>+<kbd>C</kbd>).
   - The verbatim JSON is copied to your clipboard.
   - The queue item status advances to **Copied**.
3. In ChatGPT:
   - Attach the required reference images (using the **Copy Image** button in the checklist and pressing <kbd>Ctrl</kbd>+<kbd>V</kbd> in ChatGPT).
   - Paste the prompt JSON and press **Send**.
4. Return to the HUD and click **Mark as Submitted** (advances status to **Submitted**).
5. Wait for ChatGPT to generate the vertical 9:16 cinematic image.

---

## 6. Step 4: Review, Approval & Regeneration

1. Right-click and save/download the generated image from ChatGPT (or drag it directly from ChatGPT if your browser supports direct dragging).
2. Drop the downloaded file into the **Generated Result Dropzone** in the extension HUD:
   - Format (`.png`, `.jpg`, `.webp`) is automatically detected and preserved.
   - Stored as `Attempt v1` with a timestamp and high-res 9:16 preview.
   - Queue status advances to **Awaiting Review**.
3. **If the image matches your vision**:
   - Click **Approve Scene**.
   - Status turns green (**Approved**).
   - Press <kbd>Alt</kbd>+<kbd>↓</kbd> to move immediately to the next scene.
4. **If the image needs revision**:
   - Click **Need Regeneration**.
   - Type revision feedback (e.g., *"Cooke bokeh too shallow, increase rim lighting on Mateo"*).
   - The current attempt is preserved in **Iteration History** as rejected with your feedback notes.
   - Status updates to **Regen Needed**.
   - Adjust prompt or references, copy again, and generate `Attempt v2`. Previous attempts are never overwritten!

---

## 7. Step 5: Batch Manifest & ZIP Export

Once you have approved scenes in your batch:

1. Click **Export Batch** in the header.
2. Select export preferences:
   - **Export only Approved image results** (default for production delivery).
   - Or uncheck to archive all historical generation attempts.
3. Review the export filename preview:
   ```text
   [Project]_Ep[XX]_P[YY]_Sc[AlphanumericID]_v[AttemptNum].[ext]
   ```
   *Example: `Bayani_Series_Ep01_P02_Sc68AD_v2.png`*
4. Click **Download Batch ZIP**:
   - A structured `.zip` archive downloads containing:
     - Folders grouped by `Project / EpXX_PYY / ...`
     - All approved high-resolution images preserving their original format extensions.
     - A root `manifest.json` cataloging all scenes, verbatim prompt snapshots, metadata, attempt histories, and timestamps.

---

## 8. Database Backup & Disaster Recovery

All queue data, notes, and attempts are stored locally in your browser's IndexedDB.

- **Create a Full Backup**:
  - Open **Export Batch** → click **Full DB Backup**.
  - Downloads a portable `.json` backup file containing all scene records and attempt logs.
- **Restore a Backup**:
  - Open **Export Batch** → click **Restore Backup** and select your `.json` backup file.
  - Restores all scene states, attempts, and notes instantly across the Side Panel and Dashboard.

---

## 9. Keyboard Shortcuts Cheat Sheet

Use these shortcuts in either the Side Panel HUD or Dashboard:

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>↓</kbd> / <kbd>Alt</kbd> + <kbd>→</kbd> | Jump to **Next Scene** in queue |
| <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>Alt</kbd> + <kbd>←</kbd> | Jump to **Previous Scene** in queue |
| <kbd>Alt</kbd> + <kbd>C</kbd> | **Copy Verbatim Prompt JSON** of active scene |

