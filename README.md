# SceneForge
**v1.0.0** — Real AI Image-Generation System and Cinematic Queue Manager for Brave Browser.

![SceneForge Logo](public/logo.png)

---

## Overview

SceneForge transforms cinematic **Image Prompt JSON** batches and **Character Reference Portraits** into genuine photorealistic 9:16 images directly within Brave Browser.

### Master Workflow
```text
Create Project ──> Upload Character Library ──> Import Scene JSONs ──> Select Characters Per Scene ──> Click Generate All ──> Sequential Generation (Concurrency=1) ──> Review Attempts ──> Export Deliverables ZIP
```

---

## Key Features

1. **Reusable Project Character Reference Library**
   - Upload approved reference portraits once per character.
   - Stored persistently in local IndexedDB.
   - Automatically reused across every scene in your project without re-uploading.

2. **Per-Scene Character Selection & Auto-Matching**
   - Automatically inspects each scene's `characters_visible`, `reference_images`, and `exact_character_count`.
   - Visual character picker with portrait thumbnails, wardrobe notes, and aliases.
   - Detects count mismatches and provides non-blocking diagnostic confirmation.

3. **Multi-Provider AI Generation Engine**
   - **Fal.ai (`fal-ai/flux-pulid`)** *(Recommended)*: Flux.1 [dev] + PuLID adapter for character facial identity consistency and 9:16 vertical portrait composition.
   - **Replicate (`flux-dev-multi-ip-adapter`)**: Flux.1 [dev] multi-reference IP-Adapter.
   - **OpenAI (`dall-e-3`)**: Direct text-to-image API fallback.
   - **Local Dry-Run Engine**: Zero-cost, local offline generator for testing queue pipelines without consuming API credits.

4. **Minimal Secure Local Backend (`server/`)**
   - Runs locally on `http://localhost:3001`.
   - Keeps API keys securely in `server/.env` (keys are never bundled into the frontend or exposed to web scripts).
   - Enforces **Strict Concurrency = 1** (only one scene is actively generating at any time).
   - Budget guardrail (`maxBatchSpendUsd`) automatically stops queue if spending reaches your limit.

5. **Sequential "Generate All" Queue Runner**
   - **Mode A (Full Sequential)**: Generates one scene after another until queue is complete.
   - **Mode B (Review Between Scenes)**: Generates a scene and automatically pauses for manual inspection.
   - Interactive controls: **Play**, **Pause**, **Resume**, and **Stop**.
   - Real-time progress bar showing active scene, completed count, and remaining count.

6. **Iterative Generation Attempts & Format Preservation**
   - Preserves complete iteration history (`v1`, `v2`, `v3`) without overwriting previous approved outputs.
   - Supports marking scenes as `Approved` or `Regeneration Required` with revision feedback notes.
   - Preserves native binary image formats (PNG, JPEG, WebP).

7. **Deliverables Export**
   - Generates a timestamped `.zip` containing:
     - Output images named: `[Project]_Ep[XX]_P[YY]_Sc[SceneID]_v[AttemptNum].[ext]`
     - Verbatim `manifest.json` detailing generation parameters, provider, prompt snapshot, and character mappings.

---

## Quick Start

### 1. Install & Build Extension
```bash
# Install root dependencies
npm install

# Run unit test suite
npm test

# Build extension into dist/
npm run build
```

### 2. Start Local Generation Server
```bash
# In a terminal window:
npm run server
```
The server will start on `http://localhost:3001`.

### 3. Load Extension in Brave
1. Open Brave and go to `brave://extensions`.
2. Turn ON **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select:
   ```text
   C:\Projects\SceneForge\dist
   ```
4. Pin the SceneForge icon in your Brave toolbar.

---

## Configuring Providers & API Keys

Click the **Provider** button in the SceneForge header (or open Provider Settings Modal):
1. Choose your provider: **Fal.ai**, **Replicate**, **OpenAI**, or **Local Dry-Run**.
2. Enter your API key (e.g. `FAL_KEY`, `REPLICATE_API_TOKEN`, or `OPENAI_API_KEY`).
   - Keys are securely saved to `server/.env` and masked (`fal_...1234`) in the UI.
3. Configure your **Maximum Batch Spend Limit ($USD)** (default: `$5.00`).
4. Click **Test Connection** to confirm connectivity to `http://localhost:3001`.
5. Click **Save Settings**.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + ↓` / `Alt + →` | Select **Next Scene** in queue |
| `Alt + ↑` / `Alt + ←` | Select **Previous Scene** in queue |
| `Alt + C` | **Copy Current Scene Prompt JSON** verbatim |

---

## Deliverables & Testing

- **Packaged Extension:** `sceneforge-v1.0.0.zip`
- **Source Code:** Clean React + TypeScript + Vite architecture in `src/` and Node.js backend in `server/`.
- **Test Suite:** 21 automated tests covering parsing, status lifecycle, character management, prompt synthesis, and export packaging.
