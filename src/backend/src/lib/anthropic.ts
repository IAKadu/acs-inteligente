import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY ausente — chamadas Claude vão falhar');
}

export const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL_ID = 'claude-sonnet-4-5-20250929';       // chat (main)
export const SMALL_MODEL_ID = 'claude-haiku-4-5-20251001';  // extração
