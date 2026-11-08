# SceneForge — Step-by-Step Walkthrough Guide

This walkthrough guides you through installing, configuring, and executing an end-to-end AI image-generation workflow using **SceneForge** in Brave Browser.

---

## Workflow Diagram

```text
┌─────────────────────────┐
│ 1. Character Library    │──> Upload reference portraits once (e.g. Rafael, Mariel)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. Import Scene JSONs   │──> Parse & validate Image Prompt JSON batch
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. Select Characters    │──> Auto-detect or manually map characters to each scene
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. "Generate All"       │──> Sequential execution: Concurrency = 1
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 5. Review & Iterate     │──> Inspect 9:16 results, approve, or mark for regeneration
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 6. Export Deliverables  │──> Download ZIP with organized images + manifest.json
└─────────────────────────┘
```

---

## 1. Installation & Server Setup

### Step 1.1: Start Local Generation Server
The local generation server securely holds your API credentials, enforces the single-concurrency queue, and communicates with your chosen AI provider.

1. Open PowerShell or a terminal in the project directory:
   ```powershell
   cd C:\Projects\SceneForge
   npm run server
   ```
2. You will see:
   ```text
   ==================================================
     SceneForge Generation Server
     Listening on: http://localhost:3001
     Active Provider: dryrun
     Concurrency Limit: 1 (Strictly Sequential)
   ==================================================
   ```

### Step 1.2: Load Extension in Brave
1. Open Brave and navigate to `brave://extensions`.
2. Enable the **Developer mode** toggle in the top right.
3. Click **Load unpacked**.
4. Select the build directory:
   ```text
   C:\Projects\SceneForge\dist
   ```
5. Click **Select Folder**. Pin the SceneForge clapperboard icon to your toolbar.

---

## 2. Setting Up Your Character Reference Library

You only need to upload character reference portraits **once per project**. SceneForge stores them in IndexedDB and reuses them across every scene in your queue.

1. Open SceneForge (either in the **Side Panel** or click **Maximize** to open the **Full Dashboard**).
2. In the top toolbar, click **Character Library** (or **Setup Characters**).
3. Click **+ Add Character Reference**.
4. Fill out the character profile:
   - **Name**: e.g., `Rafael`
   - **Aliases**: e.g., `Rafael Santos, Raffy, Rafael_Ref.png`
   - **Description**: e.g., `30s Filipino man, sharp jawline, determined expression`
   - **Default Wardrobe**: e.g., `Charcoal linen button-up shirt`
   - **Portrait Reference**: Upload your approved character headshot/portrait image.
5. Click **Save Character to Library**.
6. Repeat for any other project characters (e.g., `Mariel`, `Carlos`).

---

## 3. Importing Scene JSONs

SceneForge accepts your cinematic Image Prompt JSONs either as individual files or as a batch.

1. In the top toolbar, click **Import Prompts**.
2. Select one of two methods:
   - **Upload JSON Files**: Drag and drop your `.json` prompt files.
   - **Paste Batch JSON**: Paste raw JSON objects or an array of scenes.
3. The parser validates the structure:
   - Preserves your raw prompt JSON **100% verbatim**.
   - Sorts alphanumeric scene numbers (e.g. `68A`, `68AD`, `70`).
   - Automatically cross-references character names from `characters_visible` and `reference_images` against your Character Library.
4. Click **Add Scene(s) to Queue**.

---

## 4. Configuring Provider & Budget

1. Click **Provider** in the top navigation bar.
2. Select your AI generation provider:
   - **Fal.ai (`fal-ai/flux-pulid`)** *(Recommended)*: High-fidelity character visual consistency conditioned on your uploaded portraits.
   - **Replicate (`flux-dev-multi-ip-adapter`)**: Flux.1 multi-reference adapter.
   - **OpenAI (`dall-e-3`)**: Text-only fallback.
   - **Local Dry-Run Engine**: Free local offline generator that creates actual 9:16 portrait PNGs for pipeline testing.
3. If using Fal, Replicate, or OpenAI, enter your API key. The key is securely saved to `server/.env`.
4. Set your **Maximum Batch Spend Limit** (e.g. `$5.00 USD`).
5. Choose your **Batch Generation Mode**:
   - **Mode A (Full Sequential)**: Generates one scene after another automatically.
   - **Mode B (Review Between Scenes)**: Generates one scene and pauses for your inspection.
6. Click **Test Connection** to confirm the server is Online, then click **Save Settings**.

---

## 5. Generating Images

### Option A: Generate a Single Scene
1. Click any scene in the queue sidebar to view its HUD.
2. Inspect the **Assigned Character References** card. You can click character chips to toggle or assign portraits.
3. Click the primary **Generate Scene** button.
4. SceneForge synthesizes the cinematic ARRI ALEXA 35 / Cooke S4/i prompt, conditions on the character reference portrait(s), and dispatches the request to the backend.
5. In seconds, the resulting 9:16 portrait image renders directly in the HUD!

### Option B: Sequential "Generate All" Batch Runner
1. In the top header, click **Generate All**.
2. The sequential queue runner starts:
   - **Strict Concurrency = 1**: Only one scene generates at a time.
   - A live progress banner displays the active scene, completed count, and remaining count.
   - You can click **Pause** at any time to pause after the current scene finishes.
   - You can click **Resume** to continue or **Stop** to halt the queue.

---

## 6. Reviewing and Iterating

Each generation creates a versioned attempt (`v1`, `v2`, `v3`) without overwriting previous outputs.

- **Approve Scene**: Click **Approve Scene** to mark it as the final deliverable for export.
- **Request Revision**: Click **Regen** to enter revision notes (e.g., *"Increase rim light on hair, adjust Cooke bokeh"*). The previous attempt is marked `Rejected` and the scene is flagged for regeneration.
- **Iteration Timeline**: Click any attempt chip in the **History** timeline to compare outputs side by side.

---

## 7. Exporting Deliverables

1. In the top header, click **Export Batch**.
2. Review the export summary:
   - Total approved outputs.
   - Output filename preview: `[Project]_[Episode]_[Part]_[Scene]_[Attempt].[ext]` (e.g. `Ang_Pagbabalik_Ep01_P01_Sc68AD_v1.png`).
3. Click **Download ZIP Deliverables**.
4. SceneForge generates and downloads a clean ZIP archive containing all approved cinematic images and a complete `manifest.json`.

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>↓</kbd> / <kbd>Alt</kbd> + <kbd>→</kbd> | Next scene in queue |
| <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>Alt</kbd> + <kbd>←</kbd> | Previous scene in queue |
| <kbd>Alt</kbd> + <kbd>C</kbd> | Copy prompt JSON verbatim |
