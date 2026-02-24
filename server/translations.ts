// ---------------------------------------------------------------------------
// Proxy format translation functions — extracted for testability
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Model Mapping
// ---------------------------------------------------------------------------

const RESPONSES_API_MODELS = new Set([
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex-max',
]);

export function isResponsesModel(model: string): boolean {
  return RESPONSES_API_MODELS.has(model);
}

export function mapModelToCopilot(model: string): string {
  if (model.startsWith('claude-opus-4-6')) return 'claude-opus-4.6';
  if (model.startsWith('claude-sonnet-4-6')) return 'claude-sonnet-4.6';
  if (model.startsWith('claude-opus-4-5')) return 'claude-opus-4.5';
  if (model.startsWith('claude-sonnet-4-5')) return 'claude-sonnet-4.5';
  if (model.startsWith('claude-haiku-4-5')) return 'claude-haiku-4.5';
  return model;
}

// ---------------------------------------------------------------------------
// Anthropic → OpenAI Chat Completions
// ---------------------------------------------------------------------------

export function anthropicToOpenAI(body: any): any {
  const messages: any[] = [];

  if (body.system) {
    const systemText = typeof body.system === 'string'
      ? body.system
      : Array.isArray(body.system)
        ? body.system.map((b: any) => b.text || '').join('\n')
        : String(body.system);
    messages.push({ role: 'system', content: systemText });
  }

  for (const msg of body.messages || []) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      const textParts: string[] = [];
      const toolCalls: any[] = [];
      const toolResults: any[] = [];

      for (const block of msg.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        } else if (block.type === 'tool_result') {
          toolResults.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content),
          });
        }
      }

      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          messages.push(tr);
        }
      } else {
        const msgObj: any = { role: msg.role };
        if (textParts.length > 0) {
          msgObj.content = textParts.join('\n');
        }
        if (toolCalls.length > 0) {
          msgObj.tool_calls = toolCalls;
          if (!msgObj.content) msgObj.content = null;
        }
        if (!msgObj.content && toolCalls.length === 0) {
          msgObj.content = '';
        }
        messages.push(msgObj);
      }
    }
  }

  let tools: any[] | undefined;
  if (body.tools && body.tools.length > 0) {
    tools = body.tools.map((t: any) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  const result: any = {
    model: mapModelToCopilot(body.model),
    messages,
    max_tokens: body.max_tokens || 4096,
    temperature: 0.5,
    stream: false,
  };

  if (tools) {
    result.tools = tools;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Anthropic → OpenAI Responses API (Codex models)
// ---------------------------------------------------------------------------

export function anthropicToResponsesAPI(body: any): any {
  const input: any[] = [];

  if (body.system) {
    const systemText = typeof body.system === 'string'
      ? body.system
      : Array.isArray(body.system)
        ? body.system.map((b: any) => b.text || '').join('\n')
        : String(body.system);
    input.push({ role: 'developer', content: systemText });
  }

  for (const msg of body.messages || []) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        input.push({ role: 'user', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const textParts: string[] = [];
        for (const b of msg.content) {
          if (b.type === 'text') {
            textParts.push(b.text);
          } else if (b.type === 'tool_result') {
            const output = typeof b.content === 'string'
              ? b.content
              : Array.isArray(b.content)
                ? b.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
                : JSON.stringify(b.content);
            
            // If there's pending text, push it as a user message first
            if (textParts.length > 0) {
              input.push({ role: 'user', content: textParts.join('\n') });
              textParts.length = 0;
            }
            
            input.push({
              type: 'function_call_output',
              call_id: b.tool_use_id,
              output: output || '',
            });
          }
        }
        if (textParts.length > 0) {
          input.push({ role: 'user', content: textParts.join('\n') });
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        input.push({ role: 'assistant', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const textParts: string[] = [];
        for (const b of msg.content) {
          if (b.type === 'text' && b.text) {
            textParts.push(b.text);
          } else if (b.type === 'tool_use') {
            if (textParts.length > 0) {
              input.push({ role: 'assistant', content: textParts.join('\n') });
              textParts.length = 0;
            }
            input.push({
              type: 'function_call',
              name: b.name,
              arguments: JSON.stringify(b.input || {}),
              call_id: b.id || `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
            });
          }
        }
        if (textParts.length > 0) {
          input.push({ role: 'assistant', content: textParts.join('\n') });
        }
      }
    }
  }

  let tools: any[] | undefined;
  if (body.tools && body.tools.length > 0) {
    tools = body.tools.map((t: any) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    }));
  }

  const result: any = {
    model: mapModelToCopilot(body.model),
    input,
    max_output_tokens: body.max_tokens || 4096,
    stream: false,
  };

  if (tools) {
    result.tools = tools;
  }

  return result;
}

// ---------------------------------------------------------------------------
// OpenAI Responses API → Anthropic
// ---------------------------------------------------------------------------

export function responsesAPIToAnthropic(response: any, originalModel: string): any {
  const content: any[] = [];
  let hasToolCalls = false;

  if (response.output && Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type === 'message' && item.content) {
        for (const block of item.content) {
          if (block.type === 'output_text' && block.text) {
            content.push({ type: 'text', text: block.text });
          }
        }
      } else if (item.type === 'function_call') {
        hasToolCalls = true;
        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(item.arguments || '{}');
        } catch {
          parsedArgs = { raw: item.arguments };
        }
        content.push({
          type: 'tool_use',
          id: item.call_id || item.id || `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
          name: item.name,
          input: parsedArgs,
        });
      }
    }
  }

  if (content.length === 0) {
    content.push({ type: 'text', text: '' });
  }

  let stop_reason = 'end_turn';
  if (hasToolCalls) {
    stop_reason = 'tool_use';
  } else if (response.status !== 'completed') {
    stop_reason = 'max_tokens';
  }

  return {
    id: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
    type: 'message',
    role: 'assistant',
    content,
    model: originalModel,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completions → Anthropic
// ---------------------------------------------------------------------------

export function openAIToAnthropic(response: any, originalModel: string): any {
  const choice = response.choices?.[0];

  if (!choice) {
    return {
      id: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '(empty response from model)' }],
      model: originalModel,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const content: any[] = [];

  if (choice.message?.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  if (choice.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments || '{}');
      } catch {
        parsedArgs = { raw: tc.function.arguments };
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: parsedArgs,
      });
    }
  }

  if (content.length === 0) {
    content.push({ type: 'text', text: '' });
  }

  let stop_reason = 'end_turn';
  if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
    if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
      stop_reason = 'tool_use';
    } else {
      stop_reason = 'end_turn';
    }
  } else if (choice.finish_reason === 'length') {
    stop_reason = 'max_tokens';
  }

  return {
    id: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
    type: 'message',
    role: 'assistant',
    content,
    model: originalModel,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}
