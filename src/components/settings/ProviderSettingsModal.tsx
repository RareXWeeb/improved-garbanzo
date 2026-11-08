import React, { useState, useEffect } from 'react';
import { X, Server, Key, Shield, CheckCircle2, AlertCircle, RefreshCw, Cpu, DollarSign } from 'lucide-react';
import { GenerationSettings } from '../../types/queue';
import { checkServerHealth, getServerConfig, updateServerConfig, ServerHealth, ServerConfig } from '../../services/generationClient';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GenerationSettings;
  onSaveSettings: (settings: GenerationSettings) => void;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<GenerationSettings>(settings);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // API Key inputs (kept blank unless user wants to change them)
  const [falKeyInput, setFalKeyInput] = useState('');
  const [replicateKeyInput, setReplicateKeyInput] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const verifyConnection = async (url = localSettings.backendUrl) => {
    setIsCheckingHealth(true);
    try {
      const health = await checkServerHealth(url);
      setServerHealth(health);

      if (health.status === 'ok') {
        const cfg = await getServerConfig(url);
        setServerConfig(cfg);
      }
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      verifyConnection();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. If user typed any keys, update server config
      const keyUpdates: Record<string, any> = {
        provider: localSettings.provider,
        modelId: localSettings.modelId,
        maxBatchSpendUsd: localSettings.maxBatchSpendUsd,
      };

      if (falKeyInput.trim()) keyUpdates.falKey = falKeyInput.trim();
      if (replicateKeyInput.trim()) keyUpdates.replicateKey = replicateKeyInput.trim();
      if (openaiKeyInput.trim()) keyUpdates.openaiKey = openaiKeyInput.trim();

      const serverUpdated = await updateServerConfig(keyUpdates, localSettings.backendUrl);
      if (!serverUpdated && localSettings.provider !== 'dryrun') {
        showToast('Warning: Could not sync settings with generation server.', 'error');
      }

      // 2. Persist in local storage / project settings
      onSaveSettings(localSettings);
      showToast('Generation settings saved', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Provider & Generation Settings</h2>
              <p className="text-xs text-zinc-400">Configure generation engine, secure backend, and API credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Server Connection Status */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-200">Local Generation Server</span>
                {serverHealth?.status === 'ok' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Online ({localSettings.backendUrl})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Offline / Disconnected
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => verifyConnection()}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />}
              >
                Test Connection
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-[11px] font-mono">
              <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                <span className="text-zinc-500 block">Server URL</span>
                <input
                  type="text"
                  value={localSettings.backendUrl}
                  onChange={(e) => setLocalSettings({ ...localSettings, backendUrl: e.target.value })}
                  className="w-full bg-transparent text-zinc-200 focus:outline-none"
                />
              </div>
              <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                <span className="text-zinc-500 block">Total Spent (Session)</span>
                <span className="text-zinc-200">${(serverHealth?.budget?.totalSpentUsd || 0).toFixed(3)} USD</span>
              </div>
              <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                <span className="text-zinc-500 block">Concurrency Limit</span>
                <span className="text-emerald-400">Strictly 1 (Sequential)</span>
              </div>
            </div>

            {serverHealth?.status !== 'ok' && (
              <div className="mt-3 text-xs text-amber-400/90 bg-amber-950/20 border border-amber-800/40 p-2.5 rounded">
                💡 Tip: Start the local generation server by running{' '}
                <code className="text-amber-200 font-mono bg-zinc-900 px-1.5 py-0.5 rounded">npm run server</code> in
                the project terminal.
              </div>
            )}
          </div>

          {/* AI Provider Selection */}
          <div>
            <label className="text-xs font-semibold text-zinc-200 block mb-2">Image Generation Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Fal.ai Flux PuLID */}
              <div
                onClick={() =>
                  setLocalSettings({
                    ...localSettings,
                    provider: 'fal',
                    modelId: 'fal-ai/flux-pulid',
                  })
                }
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  localSettings.provider === 'fal'
                    ? 'bg-orange-500/10 border-orange-500/60 text-white'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-400">Fal.ai (Flux PuLID)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-orange-950/60 text-orange-300 border border-orange-800/50">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Flux.1 [dev] + PuLID. Best character face and identity consistency from uploaded reference portraits.
                </p>
                <div className="mt-2 text-[10px] font-mono text-zinc-500">~$0.04 - $0.06 / image</div>
              </div>

              {/* Replicate Flux Multi-Reference */}
              <div
                onClick={() =>
                  setLocalSettings({
                    ...localSettings,
                    provider: 'replicate',
                    modelId: 'flux-dev-multi-ip-adapter',
                  })
                }
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  localSettings.provider === 'replicate'
                    ? 'bg-purple-500/10 border-purple-500/60 text-white'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-purple-400">Replicate (Flux Multi-Ref)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50">
                    Alternative
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Flux.1 [dev] multi-reference IP-Adapter. High fidelity character consistency across varying lighting.
                </p>
                <div className="mt-2 text-[10px] font-mono text-zinc-500">~$0.04 - $0.05 / image</div>
              </div>

              {/* OpenAI DALL-E 3 */}
              <div
                onClick={() =>
                  setLocalSettings({
                    ...localSettings,
                    provider: 'openai',
                    modelId: 'dall-e-3',
                  })
                }
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  localSettings.provider === 'openai'
                    ? 'bg-blue-500/10 border-blue-500/60 text-white'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-400">OpenAI (DALL-E 3)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50">
                    Text-Only
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Photorealistic text-to-image. Note: DALL-E 3 API does not condition on uploaded reference portraits.
                </p>
                <div className="mt-2 text-[10px] font-mono text-zinc-500">$0.040 - $0.080 / image</div>
              </div>

              {/* Local Dry-Run Engine */}
              <div
                onClick={() =>
                  setLocalSettings({
                    ...localSettings,
                    provider: 'dryrun',
                    modelId: 'sceneforge-dryrun-canvas',
                  })
                }
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  localSettings.provider === 'dryrun'
                    ? 'bg-emerald-500/10 border-emerald-500/60 text-white'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-400">Local Dry-Run Engine</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                    Free / Offline
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Zero-cost local generator that renders genuine 9:16 portrait PNGs for testing queues and workflows.
                </p>
                <div className="mt-2 text-[10px] font-mono text-emerald-400">$0.00 / image (Zero API cost)</div>
              </div>
            </div>
          </div>

          {/* Secure API Key Inputs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-zinc-400" />
                API Credentials (Stored locally in server/.env)
              </label>
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" /> Protected from browser bundles
              </span>
            </div>

            {localSettings.provider === 'fal' && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400">FAL_KEY</span>
                  <span className="font-mono text-zinc-500">
                    {serverConfig?.configuredKeys?.fal
                      ? `Configured: ${serverConfig.configuredKeys.falMasked}`
                      : 'Not configured'}
                  </span>
                </div>
                <input
                  type="password"
                  placeholder={serverConfig?.configuredKeys?.fal ? 'Enter new key to replace...' : 'fal_key_...'}
                  value={falKeyInput}
                  onChange={(e) => setFalKeyInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            )}

            {localSettings.provider === 'replicate' && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400">REPLICATE_API_TOKEN</span>
                  <span className="font-mono text-zinc-500">
                    {serverConfig?.configuredKeys?.replicate
                      ? `Configured: ${serverConfig.configuredKeys.replicateMasked}`
                      : 'Not configured'}
                  </span>
                </div>
                <input
                  type="password"
                  placeholder={
                    serverConfig?.configuredKeys?.replicate ? 'Enter new token to replace...' : 'r8_... token'
                  }
                  value={replicateKeyInput}
                  onChange={(e) => setReplicateKeyInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            )}

            {localSettings.provider === 'openai' && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400">OPENAI_API_KEY</span>
                  <span className="font-mono text-zinc-500">
                    {serverConfig?.configuredKeys?.openai
                      ? `Configured: ${serverConfig.configuredKeys.openaiMasked}`
                      : 'Not configured'}
                  </span>
                </div>
                <input
                  type="password"
                  placeholder={
                    serverConfig?.configuredKeys?.openai ? 'Enter new key to replace...' : 'sk-proj-... key'
                  }
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Budget & Batch Execution Mode */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
            <div>
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Maximum Batch Spend Limit ($USD)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="500"
                value={localSettings.maxBatchSpendUsd}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, maxBatchSpendUsd: parseFloat(e.target.value) || 5 })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-zinc-600"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">Queue automatically halts if spend reaches limit.</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-200 block mb-1.5">Batch Generation Mode</label>
              <select
                value={localSettings.mode}
                onChange={(e) => setLocalSettings({ ...localSettings, mode: e.target.value as any })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-zinc-600"
              >
                <option value="auto_sequential">Mode A: Full Sequential (Auto Proceed)</option>
                <option value="review_between_scenes">Mode B: Review Between Scenes (Auto Pause)</option>
              </select>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                {localSettings.mode === 'auto_sequential'
                  ? 'Generates one scene after another until queue is complete.'
                  : 'Pauses after every scene for your manual inspection.'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};
