// ---------------------------------------------------------------------------
// OpenBrowserClaw — Tool definitions for the Gemini API (Function Declarations)
// ---------------------------------------------------------------------------

import type { ToolDefinition } from './types.js';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'bash',
    description:
      'Execute a shell command in a lightweight bash emulator. ' +
      'Supports common commands: echo, cat, head, tail, grep, sort, sed, awk, cut, tr, ' +
      'uniq, wc, ls, mkdir, cp, mv, rm, touch, pwd, cd, date, sleep, seq, jq, base64, ' +
      'tee, xargs, test, basename, dirname. Supports pipes (|), redirects (> >>), ' +
      'operators (&& || ;), and variable expansion ($VAR). ' +
      'Uses the group workspace filesystem. ' +
      'For complex logic, prefer the "javascript" tool. ' +
      'For HTTP requests, use the "fetch_url" tool.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          description: 'The bash command to execute',
        },
        timeout: {
          type: 'NUMBER',
          description: 'Timeout in seconds (default: 30, max: 120)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description:
      'Read the contents of a file from the group workspace. ' +
      'Returns the full text content of the file.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'File path relative to the group workspace root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write content to a file in the group workspace. ' +
      'Creates the file and any intermediate directories if they don\'t exist. ' +
      'Overwrites the file if it already exists.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'File path relative to the group workspace root',
        },
        content: {
          type: 'STRING',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description:
      'List files and directories in the group workspace. ' +
      'Directory names end with /. Returns sorted entries.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Directory path relative to workspace root (default: root)',
        },
      },
    },
  },
  {
    name: 'fetch_url',
    description:
      'Fetch a URL via HTTP and return the response body. ' +
      'Subject to browser CORS restrictions — works with most public APIs. ' +
      'Response is truncated to 100KB.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'The URL to fetch',
        },
        method: {
          type: 'STRING',
          description: 'HTTP method (default: GET)',
        },
        headers: {
          type: 'OBJECT',
          description: 'Request headers as key-value pairs',
        },
        body: {
          type: 'STRING',
          description: 'Request body (for POST/PUT/PATCH)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'update_memory',
    description:
      'Update the MEMORY.md memory file for this group. ' +
      'Use this to persist important context, user preferences, project state, ' +
      'and anything the agent should remember across conversations. ' +
      'This file is loaded as system context on every invocation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        content: {
          type: 'STRING',
          description: 'New content for the MEMORY.md memory file',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'create_task',
    description:
      'Create a scheduled recurring task. The task will run automatically ' +
      'on the specified schedule and send the result back to this group. ' +
      'Uses cron expressions (minute hour day-of-month month day-of-week).',
    parameters: {
      type: 'OBJECT',
      properties: {
        schedule: {
          type: 'STRING',
          description: 'Cron expression, e.g. "0 9 * * 1-5" for 9am weekdays',
        },
        prompt: {
          type: 'STRING',
          description: 'The prompt/instruction to execute on each run',
        },
      },
      required: ['schedule', 'prompt'],
    },
  },
  {
    name: 'javascript',
    description:
      'Execute JavaScript code in a sandboxed context and return the result. ' +
      'Lighter than bash — no VM boot required. Use for calculations, ' +
      'data transformations, JSON processing, etc. ' +
      'Has access to standard JS built-ins but no DOM or network.',
    parameters: {
      type: 'OBJECT',
      properties: {
        code: {
          type: 'STRING',
          description: 'JavaScript code to execute. The return value of the last expression is captured.',
        },
      },
      required: ['code'],
    },
  },
];
