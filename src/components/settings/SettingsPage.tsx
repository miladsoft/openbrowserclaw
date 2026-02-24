// ---------------------------------------------------------------------------
// OpenBrowserClaw — Settings page
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  Palette, KeyRound, Eye, EyeOff, Bot, MessageSquare,
  Smartphone, HardDrive, Lock, Check, Github, Zap,
} from 'lucide-react';
import { getConfig, setConfig } from '../../db.js';
import { CONFIG_KEYS } from '../../config.js';
import type { ApiProvider } from '../../config.js';
import { getStorageEstimate, requestPersistentStorage } from '../../storage.js';
import { decryptValue } from '../../crypto.js';
import { getOrchestrator } from '../../stores/orchestrator-store.js';
import { useThemeStore, type ThemeChoice } from '../../stores/theme-store.js';

const MODELS = [
  { value: 'claude-opus-4.6', label: 'Claude Opus 4.6', multiplier: 3 },
  { value: 'claude-opus-4.6-fast', label: 'Claude Opus 4.6 (fast mode)', multiplier: 30 },
  { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', multiplier: 1 },
  { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', multiplier: 0.33 },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', multiplier: 1 },
  { value: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', multiplier: 1 },
  { value: 'gpt-5.2', label: 'GPT-5.2', multiplier: 1 },
  { value: 'gpt-5.1', label: 'GPT-5.1', multiplier: 1 },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini', multiplier: 0.33 },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', multiplier: 1 },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', multiplier: 1 },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', multiplier: 0.33 },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

export function SettingsPage() {
  const orch = getOrchestrator();

  // Provider
  const [provider, setProviderState] = useState<ApiProvider>(orch.getProvider());

  // API Key (Anthropic direct)
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // GitHub Token (Copilot proxy)
  const [githubToken, setGithubToken] = useState('');
  const [githubTokenMasked, setGithubTokenMasked] = useState(true);
  const [githubTokenSaved, setGithubTokenSaved] = useState(false);
  const [githubTokenError, setGithubTokenError] = useState('');
  const [copilotStatus, setCopilotStatus] = useState<string>('');
  const [copilotConnected, setCopilotConnected] = useState(false);
  const [copilotChecking, setCopilotChecking] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);

  // Model
  const [model, setModel] = useState(orch.getModel());

  // Assistant name
  const [assistantName, setAssistantName] = useState(orch.getAssistantName());

  // Telegram
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatIds, setTelegramChatIds] = useState('');
  const [telegramSaved, setTelegramSaved] = useState(false);

  // Storage
  const [storageUsage, setStorageUsage] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [isPersistent, setIsPersistent] = useState(false);

  // Theme
  const { theme, setTheme } = useThemeStore();

  // Load current values
  useEffect(() => {
    async function load() {
      // API key
      const encKey = await getConfig(CONFIG_KEYS.ANTHROPIC_API_KEY);
      if (encKey) {
        try {
          const dec = await decryptValue(encKey);
          setApiKey(dec);
        } catch {
          setApiKey('');
        }
      }

      // GitHub token
      const encGh = await getConfig(CONFIG_KEYS.GITHUB_TOKEN);
      if (encGh) {
        try {
          const dec = await decryptValue(encGh);
          setGithubToken(dec);
        } catch {
          setGithubToken('');
        }
      }

      // Check Copilot proxy status
      const status = await orch.getCopilotStatus();
      setCopilotConnected(status.authenticated);
      setCopilotStatus(status.authenticated ? '✓ Connected' : status.reason || 'Not connected');

      // Telegram
      const token = await getConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN);
      if (token) setTelegramToken(token);
      const chatIds = await getConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS);
      if (chatIds) {
        try {
          setTelegramChatIds(JSON.parse(chatIds).join(', '));
        } catch {
          setTelegramChatIds(chatIds);
        }
      }

      // Storage
      const est = await getStorageEstimate();
      setStorageUsage(est.usage);
      setStorageQuota(est.quota);
      if (navigator.storage?.persisted) {
        setIsPersistent(await navigator.storage.persisted());
      }
    }
    load();
  }, []);

  async function handleSaveApiKey() {
    await orch.setApiKey(apiKey.trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  async function handleProviderChange(value: ApiProvider) {
    setProviderState(value);
    await orch.setProvider(value);
    if (value === 'copilot-proxy') {
      // Re-check proxy status when switching
      setCopilotChecking(true);
      const status = await orch.getCopilotStatus();
      setCopilotConnected(status.authenticated);
      setCopilotStatus(status.authenticated ? '✓ Connected' : status.reason || 'Not connected');
      setCopilotChecking(false);
    }
  }

  async function handleConnectCopilot() {
    setCopilotChecking(true);
    setGithubTokenError('');
    const status = await orch.getCopilotStatus();
    if (status.authenticated) {
      setCopilotConnected(true);
      setCopilotStatus('✓ Connected');
    } else {
      setCopilotConnected(false);
      setCopilotStatus(status.reason || 'Not connected');
      setShowManualToken(true);
    }
    setCopilotChecking(false);
  }

  async function handleSaveGithubToken() {
    setGithubTokenError('');
    try {
      await orch.setGithubToken(githubToken.trim());
      setGithubTokenSaved(true);
      setTimeout(() => setGithubTokenSaved(false), 2000);
      const status = await orch.getCopilotStatus();
      setCopilotStatus(status.authenticated ? '✓ Connected' : status.reason || 'Not connected');
    } catch (err: any) {
      setGithubTokenError(err.message || 'Failed to authenticate');
    }
  }

  async function handleModelChange(value: string) {
    setModel(value);
    await orch.setModel(value);
  }

  async function handleNameSave() {
    await orch.setAssistantName(assistantName.trim());
  }

  async function handleTelegramSave() {
    const ids = telegramChatIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await orch.configureTelegram(telegramToken.trim(), ids);
    setTelegramSaved(true);
    setTimeout(() => setTelegramSaved(false), 2000);
  }

  async function handleRequestPersistent() {
    const granted = await requestPersistentStorage();
    setIsPersistent(granted);
  }

  const storagePercent = storageQuota > 0 ? (storageUsage / storageQuota) * 100 : 0;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl font-bold mb-4">Settings</h2>

      {/* ---- Theme ---- */}
      <div className="card card-bordered bg-base-200">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Palette className="w-4 h-4" /> Appearance</h3>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Theme</legend>
            <select
              className="select select-bordered select-sm w-full"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeChoice)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </fieldset>
        </div>
      </div>

      {/* ---- API Provider ---- */}
      <div className="card card-bordered bg-base-200">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Zap className="w-4 h-4" /> API Provider</h3>
          <div className="flex gap-2">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="provider"
                className="radio radio-sm radio-primary"
                checked={provider === 'anthropic'}
                onChange={() => handleProviderChange('anthropic')}
              />
              <span className="label-text">Anthropic Direct</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="provider"
                className="radio radio-sm radio-primary"
                checked={provider === 'copilot-proxy'}
                onChange={() => handleProviderChange('copilot-proxy')}
              />
              <span className="label-text">GitHub Copilot Proxy</span>
            </label>
          </div>
          <p className="text-xs opacity-50">
            {provider === 'anthropic'
              ? 'Calls Anthropic API directly from the browser. Requires an API key.'
              : 'Routes through GitHub Copilot\'s backend. Requires a GitHub token with Copilot access.'}
          </p>
        </div>
      </div>

      {/* ---- API Key (Anthropic Direct) ---- */}
      {provider === 'anthropic' && (
        <div className="card card-bordered bg-base-200">
          <div className="card-body p-4 sm:p-6 gap-3">
            <h3 className="card-title text-base gap-2"><KeyRound className="w-4 h-4" /> Anthropic API Key</h3>
            <div className="flex gap-2">
              <input
                type={apiKeyMasked ? 'password' : 'text'}
                className="input input-bordered input-sm w-full flex-1 font-mono"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setApiKeyMasked(!apiKeyMasked)}
              >
                {apiKeyMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim()}
              >
                Save
              </button>
              {apiKeySaved && (
                <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>
              )}
            </div>
            <p className="text-xs opacity-50">
              Your API key is encrypted and stored locally. It never leaves your browser.
            </p>
          </div>
        </div>
      )}

      {/* ---- GitHub Copilot Proxy ---- */}
      {provider === 'copilot-proxy' && (
        <div className="card card-bordered bg-base-200">
          <div className="card-body p-4 sm:p-6 gap-3">
            <h3 className="card-title text-base gap-2"><Github className="w-4 h-4" /> GitHub Copilot</h3>

            {copilotConnected ? (
              <>
                <div className="badge badge-success gap-1.5 py-3 px-4">
                  <Check className="w-4 h-4" /> Connected to Copilot
                </div>
                <p className="text-xs opacity-50">
                  Proxy is authenticated and ready. You can start chatting.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    className={`btn btn-primary btn-sm ${copilotChecking ? 'loading' : ''}`}
                    onClick={handleConnectCopilot}
                    disabled={copilotChecking}
                  >
                    {copilotChecking ? 'Checking...' : 'Connect to Copilot'}
                  </button>
                </div>

                {copilotStatus && !copilotConnected && (
                  <p className="text-sm text-warning">{copilotStatus}</p>
                )}

                {showManualToken && (
                  <>
                    <div className="divider text-xs opacity-50">Or enter token manually</div>
                    <div className="flex gap-2">
                      <input
                        type={githubTokenMasked ? 'password' : 'text'}
                        className="input input-bordered input-sm w-full flex-1 font-mono"
                        placeholder="ghp_... or gho_..."
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setGithubTokenMasked(!githubTokenMasked)}
                      >
                        {githubTokenMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveGithubToken}
                        disabled={!githubToken.trim()}
                      >
                        Save & Verify
                      </button>
                      {githubTokenSaved && (
                        <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Connected</span>
                      )}
                    </div>
                    {githubTokenError && (
                      <p className="text-error text-sm">{githubTokenError}</p>
                    )}
                  </>
                )}

                <p className="text-xs opacity-50">
                  Make sure the proxy server is running (<code className="font-mono">npm run dev:proxy</code>).
                  Set <code className="font-mono">GITHUB_TOKEN</code> env var or use <code className="font-mono">gh auth token</code>.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- Model ---- */}
      <div className="card card-bordered bg-base-200">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Bot className="w-4 h-4" /> Model</h3>
          <select
            className="select select-bordered select-sm"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}{m.multiplier !== 1 ? ` (${m.multiplier}x)` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Assistant Name ---- */}
      <div className="card card-bordered bg-base-200">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><MessageSquare className="w-4 h-4" /> Assistant Name</h3>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1"
              placeholder="Andy"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              onBlur={handleNameSave}
            />
          </div>
          <p className="text-xs opacity-50">
            The name used for the assistant. Mention @{assistantName} to trigger a response.
          </p>
        </div>
      </div>

      {/* ---- Telegram ---- */}
      <div className="card card-bordered bg-base-200">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Smartphone className="w-4 h-4" /> Telegram Bot</h3>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Bot Token</legend>
            <input
              type="password"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="123456:ABC-DEF..."
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Allowed Chat IDs</legend>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="-100123456, 789012"
              value={telegramChatIds}
              onChange={(e) => setTelegramChatIds(e.target.value)}
            />
            <p className="fieldset-label opacity-60">Comma-separated chat IDs</p>
          </fieldset>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleTelegramSave}
              disabled={!telegramToken.trim()}
            >
              Save Telegram Config
            </button>
            {telegramSaved && (
              <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>
            )}
          </div>
        </div>
      </div>

      {/* ---- Storage ---- */}
      <div className="card card-bordered bg-base-200">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><HardDrive className="w-4 h-4" /> Storage</h3>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>{formatBytes(storageUsage)} used</span>
              <span className="opacity-60">
                of {formatBytes(storageQuota)}
              </span>
            </div>
            <progress
              className="progress progress-primary w-full h-2"
              value={storagePercent}
              max={100}
            />
          </div>
          {!isPersistent && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleRequestPersistent}
            >
              <Lock className="w-4 h-4" /> Request Persistent Storage
            </button>
          )}
          {isPersistent && (
            <div className="badge badge-success badge-sm gap-1.5">
              <Lock className="w-3 h-3" /> Persistent storage active
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
