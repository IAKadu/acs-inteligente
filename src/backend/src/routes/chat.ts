import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { claude, MODEL_ID } from '../lib/anthropic.js';
import { CHAT_TOOLS, executeTool } from '../lib/chat-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SYSTEM_PROMPT = readFileSync(
  resolve(__dirname, '../prompts/chat-system.md'),
  'utf-8',
);

export const chat = new Hono();

interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

chat.post('/', async (c) => {
  const { message, history = [] } = await c.req.json<ChatRequest>();

  return streamSSE(c, async (stream) => {
    const messages: Anthropic.MessageParam[] = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    let safety = 5;
    while (safety-- > 0) {
      const response = await claude.messages.create({
        model: MODEL_ID,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: CHAT_TOOLS as unknown as Anthropic.Tool[],
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      const toolUses = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

      if (toolUses.length === 0) {
        const textBlocks = response.content.filter(b => b.type === 'text');
        for (const block of textBlocks) {
          if (block.type === 'text') {
            await stream.writeSSE({ event: 'message', data: block.text });
          }
        }
        await stream.writeSSE({ event: 'done', data: 'ok' });
        return;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolUses) {
        try {
          const result = await executeTool(tool.name, tool.input as Record<string, unknown>);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: JSON.stringify(result).slice(0, 8000),
          });
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: `Erro: ${(err as Error).message}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    await stream.writeSSE({ event: 'error', data: 'Loop de tools muito longo' });
  });
});
