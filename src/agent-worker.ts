// ---------------------------------------------------------------------------
// OpenBrowserClaw — Agent Worker
// ---------------------------------------------------------------------------
//
// Runs in a dedicated Web Worker. Owns the Gemini API tool-use loop.
// Communicates with the main thread via postMessage.
//
// This is the browser equivalent of NanoClaw's container agent runner.
// Uses raw Google Gemini API calls with a function-calling loop.

import type { WorkerInbound, WorkerOutbound, InvokePayload, CompactPayload, ConversationMessage, ThinkingLogEntry, TokenUsage } from './types.js';
import { TOOL_DEFINITIONS } from './tools.js';
import { GEMINI_API_BASE, FETCH_MAX_RESPONSE } from './config.js';
import { readGroupFile, writeGroupFile, listGroupFiles } from './storage.js';
import { executeShell } from './shell.js';
import { ulid } from './ulid.js';

// ---------------------------------------------------------------------------
// Gemini API types (local to worker)
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: string } };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: { role: string; parts: GeminiPart[] };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  error?: { code: number; message: string; status: string };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'invoke':
      await handleInvoke(payload as InvokePayload);
      break;
    case 'compact':
      await handleCompact(payload as CompactPayload);
      break;
    case 'cancel':
      // TODO: AbortController-based cancellation
      break;
  }
};

// Shell emulator needs no boot — it's pure JS over OPFS

// ---------------------------------------------------------------------------
// Convert internal messages to Gemini format
// ---------------------------------------------------------------------------

function toGeminiContents(messages: ConversationMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      // Content blocks — convert to Gemini parts
      const parts: GeminiPart[] = [];
      for (const block of msg.content) {
        if ('text' in block && typeof (block as { text?: string }).text === 'string') {
          parts.push({ text: (block as { text: string }).text });
        } else if ('functionCall' in block) {
          parts.push({ functionCall: (block as { functionCall: GeminiPart['functionCall'] }).functionCall });
        } else if ('functionResponse' in block) {
          parts.push({ functionResponse: (block as { functionResponse: GeminiPart['functionResponse'] }).functionResponse });
        }
      }
      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }
  }

  // Gemini requires alternating user/model roles. Merge consecutive same-role messages.
  const merged: GeminiContent[] = [];
  for (const c of contents) {
    if (merged.length > 0 && merged[merged.length - 1].role === c.role) {
      merged[merged.length - 1].parts.push(...c.parts);
    } else {
      merged.push({ ...c, parts: [...c.parts] });
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Build Gemini API URL
// ---------------------------------------------------------------------------

function buildGeminiUrl(model: string, apiKey: string): string {
  return `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
}

// ---------------------------------------------------------------------------
// Agent invocation — tool-use loop
// ---------------------------------------------------------------------------

async function handleInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, model, maxTokens } = payload;

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Starting', `Model: ${model} · Max tokens: ${maxTokens}`);

  try {
    let currentContents: GeminiContent[] = toGeminiContents(messages);
    let iterations = 0;
    const maxIterations = 25; // Safety limit to prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;

      const body = {
        contents: currentContents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        tools: [{
          functionDeclarations: TOOL_DEFINITIONS,
        }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 1.0,
        },
      };

      log(groupId, 'api-call', `API call #${iterations}`, `${currentContents.length} messages in context`);

      const res = await fetch(buildGeminiUrl(model, apiKey), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errBody}`);
      }

      const result: GeminiResponse = await res.json();

      // Check for API-level errors
      if (result.error) {
        throw new Error(`Gemini API error ${result.error.code}: ${result.error.message}`);
      }

      // Emit token usage
      if (result.usageMetadata) {
        post({
          type: 'token-usage',
          payload: {
            groupId,
            inputTokens: result.usageMetadata.promptTokenCount || 0,
            outputTokens: result.usageMetadata.candidatesTokenCount || 0,
            totalTokens: result.usageMetadata.totalTokenCount || 0,
            cachedTokens: result.usageMetadata.cachedContentTokenCount || 0,
            contextLimit: getContextLimit(model),
          },
        });
      }

      const candidate = result.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new Error('Gemini API returned no candidates or empty response');
      }

      const parts = candidate.content.parts;

      // Check for function calls in the response
      const functionCalls = parts.filter(
        (p): p is GeminiPart & { functionCall: NonNullable<GeminiPart['functionCall']> } =>
          !!p.functionCall,
      );

      // Log text parts
      for (const part of parts) {
        if (part.text) {
          const preview = part.text.length > 200 ? part.text.slice(0, 200) + '…' : part.text;
          log(groupId, 'text', 'Response text', preview);
        }
      }

      if (functionCalls.length > 0) {
        // Execute all function calls
        const functionResponses: GeminiPart[] = [];

        for (const fc of functionCalls) {
          const { name, args } = fc.functionCall;
          const inputPreview = JSON.stringify(args);
          const inputShort = inputPreview.length > 300 ? inputPreview.slice(0, 300) + '…' : inputPreview;
          log(groupId, 'tool-call', `Tool: ${name}`, inputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: name, status: 'running' },
          });

          const output = await executeTool(name, args, groupId);

          const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
          const outputShort = outputStr.length > 500 ? outputStr.slice(0, 500) + '…' : outputStr;
          log(groupId, 'tool-result', `Result: ${name}`, outputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: name, status: 'done' },
          });

          functionResponses.push({
            functionResponse: {
              name,
              response: {
                content: typeof output === 'string'
                  ? output.slice(0, 100_000)
                  : JSON.stringify(output).slice(0, 100_000),
              },
            },
          });
        }

        // Add model's response (with function calls) to conversation
        currentContents.push({
          role: 'model',
          parts,
        });

        // Add function responses as user message
        currentContents.push({
          role: 'user',
          parts: functionResponses,
        });

        // Re-signal typing between tool iterations
        post({ type: 'typing', payload: { groupId } });
      } else {
        // Final response — extract text from all parts
        const text = parts
          .filter((p): p is GeminiPart & { text: string } => !!p.text)
          .map((p) => p.text)
          .join('');

        // Strip internal tags (matching NanoClaw pattern)
        const cleaned = text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();

        post({ type: 'response', payload: { groupId, text: cleaned || '(no response)' } });
        return;
      }
    }

    // If we hit max iterations
    post({
      type: 'response',
      payload: {
        groupId,
        text: '⚠️ Reached maximum tool-use iterations (25). Stopping to avoid excessive API usage.',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: message } });
  }
}

// ---------------------------------------------------------------------------
// Context compaction — ask Gemini to summarize the conversation
// ---------------------------------------------------------------------------

async function handleCompact(payload: CompactPayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, model, maxTokens } = payload;

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Compacting context', `Summarizing ${messages.length} messages`);

  try {
    const compactSystemPrompt = [
      systemPrompt,
      '',
      '## COMPACTION TASK',
      '',
      'The conversation context is getting large. Produce a concise summary of the conversation so far.',
      'Include key facts, decisions, user preferences, and any important context.',
      'The summary will replace the full conversation history to stay within token limits.',
      'Be thorough but concise — aim for the essential information only.',
    ].join('\n');

    const compactMessages: ConversationMessage[] = [
      ...messages,
      {
        role: 'user' as const,
        content: 'Please provide a concise summary of our entire conversation so far. Include all key facts, decisions, code discussed, and important context. This summary will replace the full history.',
      },
    ];

    const compactContents = toGeminiContents(compactMessages);

    const body = {
      contents: compactContents,
      systemInstruction: {
        parts: [{ text: compactSystemPrompt }],
      },
      generationConfig: {
        maxOutputTokens: Math.min(maxTokens, 4096),
        temperature: 0.5,
      },
    };

    const res = await fetch(buildGeminiUrl(model, apiKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errBody}`);
    }

    const result: GeminiResponse = await res.json();

    if (result.error) {
      throw new Error(`Gemini API error ${result.error.code}: ${result.error.message}`);
    }

    const candidate = result.candidates?.[0];
    const summary = candidate?.content?.parts
      ?.filter((p): p is GeminiPart & { text: string } => !!p.text)
      .map((p) => p.text)
      .join('') || '';

    log(groupId, 'info', 'Compaction complete', `Summary: ${summary.length} chars`);
    post({ type: 'compact-done', payload: { groupId, summary } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: `Compaction failed: ${message}` } });
  }
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  groupId: string,
): Promise<string> {
  try {
    switch (name) {
      case 'bash': {
        const result = await executeShell(
          input.command as string,
          groupId,
          {},
          Math.min((input.timeout as number) || 30, 120),
        );
        let output = result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;
        if (result.exitCode !== 0 && !result.stderr) {
          output += `\n[exit code: ${result.exitCode}]`;
        }
        return output || '(no output)';
      }

      case 'read_file':
        return await readGroupFile(groupId, input.path as string);

      case 'write_file':
        await writeGroupFile(groupId, input.path as string, input.content as string);
        return `Written ${(input.content as string).length} bytes to ${input.path}`;

      case 'list_files': {
        const entries = await listGroupFiles(groupId, (input.path as string) || '.');
        return entries.length > 0 ? entries.join('\n') : '(empty directory)';
      }

      case 'fetch_url': {
        const fetchRes = await fetch(input.url as string, {
          method: (input.method as string) || 'GET',
          headers: input.headers as Record<string, string> | undefined,
          body: input.body as string | undefined,
        });
        const rawText = await fetchRes.text();
        const contentType = fetchRes.headers.get('content-type') || '';
        const status = `[HTTP ${fetchRes.status}]\n`;

        // Strip HTML to reduce token usage
        let body = rawText;
        if (contentType.includes('html') || rawText.trimStart().startsWith('<')) {
          body = stripHtml(rawText);
        }

        return status + body.slice(0, FETCH_MAX_RESPONSE);
      }

      case 'update_memory':
        await writeGroupFile(groupId, 'MEMORY.md', input.content as string);
        return 'Memory updated successfully.';

      case 'create_task': {
        // Post a dedicated message to the main thread to persist the task
        const taskData = {
          id: ulid(),
          groupId,
          schedule: input.schedule as string,
          prompt: input.prompt as string,
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
        };
        post({ type: 'task-created', payload: { task: taskData } });
        return `Task created successfully.\nSchedule: ${taskData.schedule}\nPrompt: ${taskData.prompt}`;
      }

      case 'javascript': {
        try {
          // Indirect eval: (0, eval)(...) runs in global scope and
          // naturally returns the value of the last expression —
          // no explicit `return` needed.
          const code = input.code as string;
          const result = (0, eval)(`"use strict";\n${code}`);
          if (result === undefined) return '(no return value)';
          if (result === null) return 'null';
          if (typeof result === 'object') {
            try { return JSON.stringify(result, null, 2); } catch { /* fall through */ }
          }
          return String(result);
        } catch (err: unknown) {
          return `JavaScript error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(message: WorkerOutbound): void {
  (self as unknown as Worker).postMessage(message);
}

/**
 * Extract readable text from HTML, stripping tags, scripts, styles, and
 * collapsing whitespace.  Runs in the worker (no DOM), so we use regex.
 */
function stripHtml(html: string): string {
  let text = html;
  // Remove script/style/noscript blocks entirely
  text = text.replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove all tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  return text;
}

/** Map model names to their context window limits (tokens). */
function getContextLimit(model: string): number {
  // Gemini 2.5 Pro: 1M tokens, Gemini 2.5/2.0 Flash: 1M tokens
  if (model.includes('pro')) return 1_000_000;
  return 1_048_576;
}

function log(
  groupId: string,
  kind: ThinkingLogEntry['kind'],
  label: string,
  detail?: string,
): void {
  post({
    type: 'thinking-log',
    payload: { groupId, kind, timestamp: Date.now(), label, detail },
  });
}
