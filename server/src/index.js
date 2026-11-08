import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { generateMockCinematicPng } from './adapters/dryrun.js';
import { generateWithFal } from './adapters/fal.js';
import { generateWithReplicate } from './adapters/replicate.js';
import { generateWithOpenAI } from './adapters/openai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3001;

// Allow extension and local origins
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));

// In-memory runtime state & configuration
const state = {
  provider: process.env.ACTIVE_PROVIDER || 'dryrun', // 'fal' | 'replicate' | 'openai' | 'dryrun'
  modelId: process.env.MODEL_ID || 'fal-ai/flux-pulid',
  keys: {
    fal: process.env.FAL_KEY || '',
    replicate: process.env.REPLICATE_API_TOKEN || '',
    openai: process.env.OPENAI_API_KEY || '',
  },
  budget: {
    maxBatchSpendUsd: parseFloat(process.env.MAX_BATCH_SPEND_USD || '5.0'),
    totalSpentUsd: 0.0,
  },
  queue: {
    isRunning: false,
    isPaused: false,
    activeSceneId: null,
    totalScenes: 0,
    completedScenes: 0,
    failedScenes: 0,
    pendingPayloads: [],
    results: [],
  },
};

// Helper: Mask API keys for safe UI display
function maskKey(key) {
  if (!key || key.length < 8) return '';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeProvider: state.provider,
    isQueueRunning: state.queue.isRunning,
    isQueuePaused: state.queue.isPaused,
    budget: state.budget,
  });
});

// 2. Get configuration (Masked keys for security)
app.get('/api/config', (req, res) => {
  res.json({
    provider: state.provider,
    modelId: state.modelId,
    configuredKeys: {
      fal: Boolean(state.keys.fal),
      replicate: Boolean(state.keys.replicate),
      openai: Boolean(state.keys.openai),
      falMasked: maskKey(state.keys.fal),
      replicateMasked: maskKey(state.keys.replicate),
      openaiMasked: maskKey(state.keys.openai),
    },
    budget: state.budget,
  });
});

// 3. Update configuration
app.post('/api/config', (req, res) => {
  const { provider, modelId, falKey, replicateKey, openaiKey, maxBatchSpendUsd } = req.body;

  if (provider) state.provider = provider;
  if (modelId) state.modelId = modelId;
  if (falKey !== undefined) state.keys.fal = falKey;
  if (replicateKey !== undefined) state.keys.replicate = replicateKey;
  if (openaiKey !== undefined) state.keys.openai = openaiKey;
  if (maxBatchSpendUsd !== undefined) state.budget.maxBatchSpendUsd = parseFloat(maxBatchSpendUsd);

  // Write updates to .env file for persistence across server restarts
  try {
    const envContent = [
      `ACTIVE_PROVIDER=${state.provider}`,
      `MODEL_ID=${state.modelId}`,
      `FAL_KEY=${state.keys.fal}`,
      `REPLICATE_API_TOKEN=${state.keys.replicate}`,
      `OPENAI_API_KEY=${state.keys.openai}`,
      `MAX_BATCH_SPEND_USD=${state.budget.maxBatchSpendUsd}`,
    ].join('\n');
    fs.writeFileSync(envPath, envContent);
  } catch (err) {
    console.warn('Could not write to server/.env:', err);
  }

  res.json({ success: true, config: state });
});

// 4. Generate single scene image (Enforces budget and single concurrency)
async function executeGeneration(payload) {
  const provider = payload.provider || state.provider;
  let estimatedCost = 0.0;

  if (provider === 'fal') estimatedCost = 0.035;
  else if (provider === 'replicate') estimatedCost = 0.040;
  else if (provider === 'openai') estimatedCost = 0.080;

  // Check budget guardrail
  if (state.budget.totalSpentUsd + estimatedCost > state.budget.maxBatchSpendUsd) {
    throw new Error(
      `Budget limit exceeded! Next generation ($${estimatedCost.toFixed(3)}) would exceed limit ($${state.budget.maxBatchSpendUsd.toFixed(2)}). Total spent: $${state.budget.totalSpentUsd.toFixed(3)}.`
    );
  }

  let result;
  if (provider === 'fal') {
    result = await generateWithFal(payload, state.keys.fal, payload.modelId || state.modelId);
  } else if (provider === 'replicate') {
    result = await generateWithReplicate(payload, state.keys.replicate, payload.modelId);
  } else if (provider === 'openai') {
    result = await generateWithOpenAI(payload, state.keys.openai);
  } else {
    // Dry-run mode
    const buf = generateMockCinematicPng(payload.sceneId, payload.prompt, payload.referenceImages);
    result = {
      imageBuffer: buf,
      mimeType: 'image/png',
      costEstimate: 0.0,
      modelUsed: 'local/dryrun-cinematic',
    };
  }

  state.budget.totalSpentUsd += result.costEstimate || 0.0;
  return result;
}

app.post('/api/generate', async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.prompt) {
    return res.status(400).json({ error: 'Missing generation prompt payload.' });
  }

  try {
    const result = await executeGeneration(payload);
    // Return base64 encoded data URI
    const base64Data = result.imageBuffer.toString('base64');
    const dataUri = `data:${result.mimeType};base64,${base64Data}`;

    res.json({
      success: true,
      dataUri,
      mimeType: result.mimeType,
      costEstimate: result.costEstimate,
      modelUsed: result.modelUsed,
      totalSpentUsd: state.budget.totalSpentUsd,
    });
  } catch (err) {
    console.error('Generation execution error:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// 5. Sequential Queue Runner (Strict Concurrency = 1)
app.post('/api/queue/start', async (req, res) => {
  const { payloads } = req.body;
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return res.status(400).json({ error: 'No scene payloads provided to start queue.' });
  }

  if (state.queue.isRunning) {
    return res.status(409).json({ error: 'Queue is already actively running.' });
  }

  state.queue.isRunning = true;
  state.queue.isPaused = false;
  state.queue.pendingPayloads = [...payloads];
  state.queue.totalScenes = payloads.length;
  state.queue.completedScenes = 0;
  state.queue.failedScenes = 0;
  state.queue.results = [];

  // Start background sequential runner (Concurrency = 1)
  runSequentialQueue().catch((err) => {
    console.error('Sequential queue runner error:', err);
    state.queue.isRunning = false;
  });

  res.json({ success: true, message: 'Sequential queue started', total: payloads.length });
});

async function runSequentialQueue() {
  while (state.queue.pendingPayloads.length > 0) {
    if (!state.queue.isRunning) break;
    if (state.queue.isPaused) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    const currentPayload = state.queue.pendingPayloads.shift();
    state.queue.activeSceneId = currentPayload.sceneId;

    try {
      console.log(`[Queue] Generating Scene ${currentPayload.sceneId}...`);
      const result = await executeGeneration(currentPayload);
      const base64Data = result.imageBuffer.toString('base64');
      const dataUri = `data:${result.mimeType};base64,${base64Data}`;

      state.queue.results.push({
        sceneId: currentPayload.sceneId,
        success: true,
        dataUri,
        mimeType: result.mimeType,
        costEstimate: result.costEstimate,
        modelUsed: result.modelUsed,
        timestamp: Date.now(),
      });
      state.queue.completedScenes++;
    } catch (err) {
      console.error(`[Queue] Failed Scene ${currentPayload.sceneId}:`, err);
      state.queue.results.push({
        sceneId: currentPayload.sceneId,
        success: false,
        error: err.message,
        timestamp: Date.now(),
      });
      state.queue.failedScenes++;
    }

    state.queue.activeSceneId = null;
    // Controlled small delay between generations to respect provider rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  state.queue.isRunning = false;
  state.queue.isPaused = false;
  console.log('[Queue] Finished batch processing.');
}

app.post('/api/queue/pause', (req, res) => {
  state.queue.isPaused = true;
  res.json({ success: true, isPaused: true, activeSceneId: state.queue.activeSceneId });
});

app.post('/api/queue/resume', (req, res) => {
  state.queue.isPaused = false;
  res.json({ success: true, isPaused: false });
});

app.post('/api/queue/stop', (req, res) => {
  state.queue.isRunning = false;
  state.queue.pendingPayloads = [];
  res.json({ success: true, isRunning: false });
});

app.get('/api/queue/status', (req, res) => {
  res.json({
    isRunning: state.queue.isRunning,
    isPaused: state.queue.isPaused,
    activeSceneId: state.queue.activeSceneId,
    totalScenes: state.queue.totalScenes,
    completedScenes: state.queue.completedScenes,
    failedScenes: state.queue.failedScenes,
    remainingScenes: state.queue.pendingPayloads.length,
    results: state.queue.results,
    totalSpentUsd: state.budget.totalSpentUsd,
  });
});

app.listen(PORT, () => {
  console.log(`SceneForge Generation Server running on http://localhost:${PORT}`);
  console.log(`Active Provider: ${state.provider} | Model: ${state.modelId}`);
});
