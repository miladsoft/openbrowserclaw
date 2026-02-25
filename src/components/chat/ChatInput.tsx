// ---------------------------------------------------------------------------
// OpenBrowserClaw — Chat input
// ---------------------------------------------------------------------------

import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, ChevronDown } from 'lucide-react';
import { getOrchestrator } from '../../stores/orchestrator-store.js';

const MODELS = [
  { value: 'claude-opus-4.6', label: 'Claude Opus 4.6', group: 'Anthropic', multiplier: 3 },
  { value: 'claude-opus-4.6-fast', label: 'Claude Opus 4.6 (fast mode)', group: 'Anthropic', multiplier: 30 },
  { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', group: 'Anthropic', multiplier: 1 },
  { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', group: 'Anthropic', multiplier: 0.33 },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', group: 'OpenAI', multiplier: 1 },
  { value: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', group: 'OpenAI', multiplier: 1 },
  { value: 'gpt-5.2', label: 'GPT-5.2', group: 'OpenAI', multiplier: 1 },
  { value: 'gpt-5.1', label: 'GPT-5.1', group: 'OpenAI', multiplier: 1 },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini', group: 'OpenAI', multiplier: 0.33 },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', group: 'Google', multiplier: 1 },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', group: 'Google', multiplier: 0.33 },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', group: 'Google', multiplier: 1 },
];

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [model, setModel] = useState(() => getOrchestrator().getModel());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  async function handleModelChange(value: string) {
    setModel(value);
    await getOrchestrator().setModel(value);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const currentModel = MODELS.find((m) => m.value === model);
  const currentLabel = currentModel?.label || model;
  const currentMultiplier = currentModel?.multiplier || 1;
  const groups = [...new Set(MODELS.map((m) => m.group))];

  function badgeColor(x: number) {
    if (x >= 30) return 'badge-error animate-pulse';
    if (x >= 3) return 'badge-warning';
    if (x < 1) return 'badge-success';
    return 'badge-neutral badge-outline opacity-60';
  }

  return (
    <div className="flex flex-col gap-1 p-4 pt-2">
      {/* Model selector row */}
      <div className="flex items-center gap-1.5 px-1">
        <div className="dropdown dropdown-top">
          <label tabIndex={0} className="btn btn-ghost btn-xs gap-1 font-normal opacity-60 hover:opacity-100">
            {currentLabel}
            <span className={`badge badge-xs ${badgeColor(currentMultiplier)}`}>{currentMultiplier}x</span>
            <ChevronDown className="w-3 h-3" />
          </label>
          <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-200 rounded-box shadow-lg z-50 w-56 mb-1 max-h-80 overflow-y-auto">
            {groups.map((group) => (
              <li key={group}>
                <h2 className="menu-title text-xs opacity-40">{group}</h2>
                <ul>
                  {MODELS.filter((m) => m.group === group).map((m) => (
                    <li key={m.value}>
                      <button
                        className={`flex justify-between ${model === m.value ? 'active' : ''}`}
                        onClick={() => handleModelChange(m.value)}
                      >
                        <span>{m.label}</span>
                        <span className={`badge badge-xs ${badgeColor(m.multiplier)}`}>{m.multiplier}x</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
        {currentMultiplier >= 30 && (
          <span className="text-xs text-error opacity-80">⚠ Ultra premium — uses {currentMultiplier}x requests!</span>
        )}
        {currentMultiplier >= 3 && currentMultiplier < 30 && (
          <span className="text-xs text-warning opacity-70">⚠ Premium — uses {currentMultiplier}x requests</span>
        )}
        {currentMultiplier < 1 && (
          <span className="text-xs text-success opacity-70">✓ Economy — uses {currentMultiplier}x requests</span>
        )}
      </div>
      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          className="textarea textarea-bordered flex-1 chat-textarea text-base leading-snug"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button
          className="btn btn-primary btn-circle"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
