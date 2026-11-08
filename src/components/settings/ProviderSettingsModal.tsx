import React, { useState, useEffect } from 'react';
import { X, Server, Key, Shield, RefreshCw, Cpu, DollarSign } from 'lucide-react';
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

  // Key inputs
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
        showToast('Notice: Could not connect to local server on localhost:3001.', 'info');
      }

      onSaveSettings(localSettings);
      showToast('Settings saved', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const providers = [
    {
      id: 'fal' as const,
      modelId: 'fal-ai/flux-pulid',
      name: 'Fal.ai (Flux PuLID)',
      badge: 'Recommended',
      description: 'Face & identity consistency from character reference portraits with 9:16 portrait framing.',
      pricing: '~$0.04 - $0.06 / image',
    },
    {
      id: 'replicate' as const,
      modelId: 'flux-dev-multi-ip-adapter',
      name: 'Replicate (Flux Multi-Ref)',
      badge: 'Alternative',
      description: 'Multi-reference IP-Adapter for strong character consistency across scenes.',
      pricing: '~$0.04 - $0.05 / image',
    },
    {
      id: 'openai' as const,
      modelId: 'dall-e-3',
      name: 'OpenAI (DALL-E 3)',
      badge: 'Text-Only',
      description: 'Prompt-based rendering. Note: DALL-E 3 does not condition on uploaded reference portraits.',
      pricing: '$0.040 - $0.080 / image',
    },
    {
      id: 'dryrun' as const,
      modelId: 'sceneforge-dryrun-canvas',
      name: 'Local Test Engine',
      badge: 'Free / Offline',
      description: 'Zero-cost local generator that renders genuine 9:16 portrait PNGs to test workflows.',
      pricing: '$0.00 / image',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-semibold text-white">Generation Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">
          {/* Server Connection Pill */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-medium text-zinc-300">Local Engine Server</span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                    serverHealth?.status === 'ok'
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                      : 'bg-zinc-850 text-zinc-400 border border-zinc-750'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      serverHealth?.status === 'ok' ? 'bg-emerald-400' : 'bg-zinc-500'
                    }`}
                  />
                  {serverHealth?.status === 'ok' ? 'Connected' : 'Offline (npm run server)'}
                </span>
              </div>

              <button
                onClick={() => verifyConnection()}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                title="Test connection"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                <span>Check</span>
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>URL: {localSettings.backendUrl}</span>
              <span>Concurrency: 1 (Sequential)</span>
              <span>Spent: ${(serverHealth?.budget?.totalSpentUsd || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Provider Selection */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">AI Provider</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {providers.map((p) => {
                const isSelected = localSettings.provider === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() =>
                      setLocalSettings({
                        ...localSettings,
                        provider: p.id,
                        modelId: p.modelId,
                      })
                    }
                    className={`p-3 rounded-lg border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-zinc-800/80 border-zinc-200 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-zinc-100">{p.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">{p.description}</p>
                    <div className="mt-2 text-[10px] font-mono text-zinc-500">{p.pricing}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* API Key Configuration */}
          {localSettings.provider !== 'dryrun' && (
            <div className="space-y-2 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-zinc-400" />
                  API Key
                </label>
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" /> Stored locally in server/.env
                </span>
              </div>

              {localSettings.provider === 'fal' && (
                <div>
                  <input
                    type="password"
                    placeholder={
                      serverConfig?.configuredKeys?.fal
                        ? `Configured (${serverConfig.configuredKeys.falMasked}) - Enter to replace`
                        : 'fal_key_...'
                    }
                    value={falKeyInput}
                    onChange={(e) => setFalKeyInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
              )}

              {localSettings.provider === 'replicate' && (
                <div>
                  <input
                    type="password"
                    placeholder={
                      serverConfig?.configuredKeys?.replicate
                        ? `Configured (${serverConfig.configuredKeys.replicateMasked}) - Enter to replace`
                        : 'r8_... token'
                    }
                    value={replicateKeyInput}
                    onChange={(e) => setReplicateKeyInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
              )}

              {localSettings.provider === 'openai' && (
                <div>
                  <input
                    type="password"
                    placeholder={
                      serverConfig?.configuredKeys?.openai
                        ? `Configured (${serverConfig.configuredKeys.openaiMasked}) - Enter to replace`
                        : 'sk-proj-... key'
                    }
                    value={openaiKeyInput}
                    onChange={(e) => setOpenaiKeyInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Budget Limit & Sequential Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
            <div>
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                Budget Limit ($USD)
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
              <span className="text-[10px] text-zinc-500 mt-0.5 block">Halts queue if reached.</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Batch Mode</label>
              <select
                value={localSettings.mode}
                onChange={(e) => setLocalSettings({ ...localSettings, mode: e.target.value as any })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              >
                <option value="auto_sequential">Full Sequential (Auto-proceed)</option>
                <option value="review_between_scenes">Review Between Scenes (Pause)</option>
              </select>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">
                {localSettings.mode === 'auto_sequential'
                  ? 'Continues until queue completes.'
                  : 'Pauses after each scene.'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-950/60 shrink-0">
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
