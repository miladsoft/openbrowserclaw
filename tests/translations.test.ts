import { describe, it, expect } from 'vitest';
import {
  isResponsesModel,
  mapModelToCopilot,
  anthropicToOpenAI,
  anthropicToResponsesAPI,
  responsesAPIToAnthropic,
  openAIToAnthropic,
} from '../server/translations.js';

// ---------------------------------------------------------------------------
// mapModelToCopilot
// ---------------------------------------------------------------------------

describe('mapModelToCopilot', () => {
  it('converts dash-style claude names to dot-style', () => {
    expect(mapModelToCopilot('claude-opus-4-6')).toBe('claude-opus-4.6');
    expect(mapModelToCopilot('claude-sonnet-4-6')).toBe('claude-sonnet-4.6');
    expect(mapModelToCopilot('claude-opus-4-5')).toBe('claude-opus-4.5');
    expect(mapModelToCopilot('claude-sonnet-4-5')).toBe('claude-sonnet-4.5');
    expect(mapModelToCopilot('claude-haiku-4-5')).toBe('claude-haiku-4.5');
  });

  it('passes through already-correct names', () => {
    expect(mapModelToCopilot('claude-sonnet-4.6')).toBe('claude-sonnet-4.6');
    expect(mapModelToCopilot('gpt-4o')).toBe('gpt-4o');
    expect(mapModelToCopilot('gemini-2.5-pro')).toBe('gemini-2.5-pro');
  });

  it('handles suffix after version', () => {
    expect(mapModelToCopilot('claude-opus-4-6-fast')).toBe('claude-opus-4.6');
  });
});

// ---------------------------------------------------------------------------
// isResponsesModel
// ---------------------------------------------------------------------------

describe('isResponsesModel', () => {
  it('returns true for codex models', () => {
    expect(isResponsesModel('gpt-5.3-codex')).toBe(true);
    expect(isResponsesModel('gpt-5.1-codex-mini')).toBe(true);
    expect(isResponsesModel('gpt-5.1-codex-max')).toBe(true);
  });

  it('returns false for non-codex models', () => {
    expect(isResponsesModel('claude-sonnet-4.6')).toBe(false);
    expect(isResponsesModel('gpt-4o')).toBe(false);
    expect(isResponsesModel('gemini-2.5-pro')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// anthropicToOpenAI
// ---------------------------------------------------------------------------

describe('anthropicToOpenAI', () => {
  it('converts simple text message', () => {
    const result = anthropicToOpenAI({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.model).toBe('claude-sonnet-4.6');
    expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(result.max_tokens).toBe(1024);
    expect(result.stream).toBe(false);
  });

  it('converts system prompt (string)', () => {
    const result = anthropicToOpenAI({
      model: 'gpt-4o',
      system: 'You are helpful',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.messages[0]).toEqual({ role: 'system', content: 'You are helpful' });
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('converts system prompt (array of blocks)', () => {
    const result = anthropicToOpenAI({
      model: 'gpt-4o',
      system: [{ text: 'Rule 1' }, { text: 'Rule 2' }],
      messages: [],
    });

    expect(result.messages[0]).toEqual({ role: 'system', content: 'Rule 1\nRule 2' });
  });

  it('converts tool_use in assistant message', () => {
    const result = anthropicToOpenAI({
      model: 'gpt-4o',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'call_123', name: 'fetch_url', input: { url: 'https://example.com' } },
          ],
        },
      ],
    });

    const msg = result.messages[0];
    expect(msg.role).toBe('assistant');
    expect(msg.tool_calls).toHaveLength(1);
    expect(msg.tool_calls[0].id).toBe('call_123');
    expect(msg.tool_calls[0].function.name).toBe('fetch_url');
    expect(JSON.parse(msg.tool_calls[0].function.arguments)).toEqual({ url: 'https://example.com' });
  });

  it('converts tool_result in user message', () => {
    const result = anthropicToOpenAI({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'call_123', content: 'Result data' },
          ],
        },
      ],
    });

    expect(result.messages[0]).toEqual({
      role: 'tool',
      tool_call_id: 'call_123',
      content: 'Result data',
    });
  });

  it('converts tools from Anthropic to OpenAI format', () => {
    const result = anthropicToOpenAI({
      model: 'gpt-4o',
      messages: [],
      tools: [
        {
          name: 'fetch_url',
          description: 'Fetch a URL',
          input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        },
      ],
    });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].type).toBe('function');
    expect(result.tools[0].function.name).toBe('fetch_url');
    expect(result.tools[0].function.description).toBe('Fetch a URL');
  });

  it('handles mixed text + tool_use in assistant message', () => {
    const result = anthropicToOpenAI({
      model: 'gpt-4o',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me fetch that.' },
            { type: 'tool_use', id: 'call_1', name: 'fetch_url', input: { url: 'https://x.com' } },
          ],
        },
      ],
    });

    const msg = result.messages[0];
    expect(msg.content).toBe('Let me fetch that.');
    expect(msg.tool_calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// anthropicToResponsesAPI
// ---------------------------------------------------------------------------

describe('anthropicToResponsesAPI', () => {
  it('converts simple user message to structured input', () => {
    const result = anthropicToResponsesAPI({
      model: 'gpt-5.3-codex',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.model).toBe('gpt-5.3-codex');
    expect(result.input).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(result.max_output_tokens).toBe(4096);
  });

  it('converts system prompt to developer role', () => {
    const result = anthropicToResponsesAPI({
      model: 'gpt-5.3-codex',
      system: 'You are helpful',
      messages: [],
    });

    expect(result.input[0]).toEqual({ role: 'developer', content: 'You are helpful' });
  });

  it('converts tool_use to function_call item', () => {
    const result = anthropicToResponsesAPI({
      model: 'gpt-5.3-codex',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'call_abc', name: 'fetch_url', input: { url: 'https://x.com' } },
          ],
        },
      ],
    });

    const fc = result.input.find((i: any) => i.type === 'function_call');
    expect(fc).toBeDefined();
    expect(fc.name).toBe('fetch_url');
    expect(JSON.parse(fc.arguments)).toEqual({ url: 'https://x.com' });
    expect(fc.call_id).toBe('call_abc');
  });

  it('converts tool_result to function_call_output item', () => {
    const result = anthropicToResponsesAPI({
      model: 'gpt-5.3-codex',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'call_abc', content: '{"data": 42}' },
          ],
        },
      ],
    });

    const fco = result.input.find((i: any) => i.type === 'function_call_output');
    expect(fco).toBeDefined();
    expect(fco.call_id).toBe('call_abc');
    expect(fco.output).toBe('{"data": 42}');
  });

  it('flushes text before function_call in assistant messages', () => {
    const result = anthropicToResponsesAPI({
      model: 'gpt-5.3-codex',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Planning...' },
            { type: 'tool_use', id: 'call_1', name: 'bash', input: { command: 'ls' } },
          ],
        },
      ],
    });

    expect(result.input[0]).toEqual({ role: 'assistant', content: 'Planning...' });
    expect(result.input[1].type).toBe('function_call');
  });

  it('includes tools in OpenAI function format', () => {
    const result = anthropicToResponsesAPI({
      model: 'gpt-5.3-codex',
      messages: [],
      tools: [
        {
          name: 'bash',
          description: 'Run command',
          input_schema: { type: 'object', properties: { command: { type: 'string' } } },
        },
      ],
    });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toEqual({
      type: 'function',
      name: 'bash',
      description: 'Run command',
      parameters: { type: 'object', properties: { command: { type: 'string' } } },
    });
  });
});

// ---------------------------------------------------------------------------
// responsesAPIToAnthropic
// ---------------------------------------------------------------------------

describe('responsesAPIToAnthropic', () => {
  it('converts text output', () => {
    const result = responsesAPIToAnthropic(
      {
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'Hello!' }] },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      'gpt-5.3-codex',
    );

    expect(result.content).toEqual([{ type: 'text', text: 'Hello!' }]);
    expect(result.stop_reason).toBe('end_turn');
    expect(result.model).toBe('gpt-5.3-codex');
  });

  it('converts function_call output to tool_use', () => {
    const result = responsesAPIToAnthropic(
      {
        status: 'completed',
        output: [
          {
            type: 'function_call',
            name: 'fetch_url',
            arguments: '{"url":"https://example.com"}',
            call_id: 'call_xyz',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      },
      'gpt-5.3-codex',
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('tool_use');
    expect(result.content[0].name).toBe('fetch_url');
    expect(result.content[0].input).toEqual({ url: 'https://example.com' });
    expect(result.content[0].id).toBe('call_xyz');
    expect(result.stop_reason).toBe('tool_use');
  });

  it('handles empty output with fallback text', () => {
    const result = responsesAPIToAnthropic(
      { status: 'completed', output: [], usage: {} },
      'gpt-5.3-codex',
    );

    expect(result.content).toEqual([{ type: 'text', text: '' }]);
  });

  it('sets max_tokens stop_reason for incomplete status', () => {
    const result = responsesAPIToAnthropic(
      { status: 'incomplete', output: [], usage: {} },
      'gpt-5.3-codex',
    );

    expect(result.stop_reason).toBe('max_tokens');
  });

  it('handles malformed JSON arguments gracefully', () => {
    const result = responsesAPIToAnthropic(
      {
        status: 'completed',
        output: [
          { type: 'function_call', name: 'bash', arguments: '{bad json', call_id: 'c1' },
        ],
        usage: {},
      },
      'gpt-5.3-codex',
    );

    expect(result.content[0].input).toEqual({ raw: '{bad json' });
  });
});

// ---------------------------------------------------------------------------
// openAIToAnthropic
// ---------------------------------------------------------------------------

describe('openAIToAnthropic', () => {
  it('converts simple text response', () => {
    const result = openAIToAnthropic(
      {
        choices: [
          { message: { content: 'Hello!' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      },
      'claude-sonnet-4.6',
    );

    expect(result.content).toEqual([{ type: 'text', text: 'Hello!' }]);
    expect(result.stop_reason).toBe('end_turn');
    expect(result.model).toBe('claude-sonnet-4.6');
    expect(result.usage.input_tokens).toBe(10);
    expect(result.usage.output_tokens).toBe(5);
  });

  it('converts tool calls', () => {
    const result = openAIToAnthropic(
      {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  function: { name: 'fetch_url', arguments: '{"url":"https://x.com"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      },
      'claude-sonnet-4.6',
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('tool_use');
    expect(result.content[0].name).toBe('fetch_url');
    expect(result.content[0].input).toEqual({ url: 'https://x.com' });
    expect(result.stop_reason).toBe('tool_use');
  });

  it('handles empty choices gracefully', () => {
    const result = openAIToAnthropic(
      { choices: [], usage: {} },
      'claude-sonnet-4.6',
    );

    expect(result.content).toEqual([{ type: 'text', text: '(empty response from model)' }]);
    expect(result.stop_reason).toBe('end_turn');
  });

  it('maps length finish_reason to max_tokens', () => {
    const result = openAIToAnthropic(
      {
        choices: [{ message: { content: 'truncated...' }, finish_reason: 'length' }],
        usage: {},
      },
      'gpt-4o',
    );

    expect(result.stop_reason).toBe('max_tokens');
  });

  it('handles malformed tool call arguments', () => {
    const result = openAIToAnthropic(
      {
        choices: [
          {
            message: {
              tool_calls: [
                { id: 'c1', function: { name: 'bash', arguments: 'not json' } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {},
      },
      'gpt-4o',
    );

    expect(result.content[0].input).toEqual({ raw: 'not json' });
  });
});
