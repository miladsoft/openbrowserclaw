// ---------------------------------------------------------------------------
// OpenBrowserClaw — Configuration constants
// ---------------------------------------------------------------------------

/** Default assistant name (used in trigger pattern) */
export const ASSISTANT_NAME = 'Andy';

/** Trigger pattern — messages must match this to invoke the agent */
export function buildTriggerPattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)@${escaped}\\b`, 'i');
}

export const TRIGGER_PATTERN = buildTriggerPattern(ASSISTANT_NAME);

/** How many recent messages to include in agent context */
export const CONTEXT_WINDOW_SIZE = 50;

/** Max tokens for Claude API response */
export const DEFAULT_MAX_TOKENS = 16384;

/** Default model */
export const DEFAULT_MODEL = 'claude-sonnet-4.6';

/** Anthropic API endpoint (direct mode) */
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/** Copilot proxy endpoint (proxy mode — routed via Vite dev proxy) */
export const COPILOT_PROXY_URL = '/api/proxy/v1/messages';

/** Copilot proxy auth endpoint */
export const COPILOT_PROXY_AUTH_URL = '/api/proxy/auth/github-token';

/** Copilot proxy status endpoint */
export const COPILOT_PROXY_STATUS_URL = '/api/proxy/auth/status';

/** API provider type */
export type ApiProvider = 'anthropic' | 'copilot-proxy';

/** Anthropic API version header */
export const ANTHROPIC_API_VERSION = '2023-06-01';

/** Telegram Bot API base URL */
export const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/** Telegram message length limit */
export const TELEGRAM_MAX_LENGTH = 4096;

/** Telegram long-poll timeout in seconds */
export const TELEGRAM_POLL_TIMEOUT = 30;

/** Task scheduler check interval (ms) */
export const SCHEDULER_INTERVAL = 60_000;

/** Message processing loop interval (ms) */
export const PROCESS_LOOP_INTERVAL = 100;

/** Fetch tool response truncation limit (keep low to preserve context window) */
export const FETCH_MAX_RESPONSE = 8_000;

/** CORS proxy endpoint (routes through the proxy server to bypass CORS) */
export const CORS_PROXY_URL = '/api/proxy/cors-proxy';

/** IndexedDB database name */
export const DB_NAME = 'openbrowserclaw';

/** IndexedDB version */
export const DB_VERSION = 1;

/** OPFS root directory name */
export const OPFS_ROOT = 'openbrowserclaw';

/** Default group for browser chat */
export const DEFAULT_GROUP_ID = 'br:main';

/** Config keys */
export const CONFIG_KEYS = {
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  GITHUB_TOKEN: 'github_token',
  API_PROVIDER: 'api_provider',
  TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
  TELEGRAM_CHAT_IDS: 'telegram_chat_ids',
  TRIGGER_PATTERN: 'trigger_pattern',
  MODEL: 'model',
  MAX_TOKENS: 'max_tokens',
  PASSPHRASE_SALT: 'passphrase_salt',
  PASSPHRASE_VERIFY: 'passphrase_verify',
  ASSISTANT_NAME: 'assistant_name',
} as const;
