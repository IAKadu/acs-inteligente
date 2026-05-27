'use client';

import type { ReactNode } from 'react';

/* ── inline parser: **bold**, `code`, plain ────────────────────────── */
function parseInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // regex captures **bold** and `code`
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith('**')) {
      parts.push(<strong key={key++} style={{ color: 'var(--grey-dark)', fontWeight: 700 }}>{match[2]}</strong>);
    } else {
      parts.push(
        <code key={key++} style={{
          fontFamily: 'monospace',
          fontSize: '0.85em',
          background: 'rgba(0,74,128,.08)',
          color: 'var(--blue-primary)',
          padding: '1px 5px',
          borderRadius: '3px',
        }}>{match[3]}</code>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ── block renderer ────────────────────────────────────────────────── */
function renderBlocks(content: string): ReactNode[] {
  // Split on blank lines to get blocks
  const rawBlocks = content.split(/\n{2,}/);
  const nodes: ReactNode[] = [];
  let key = 0;

  for (const block of rawBlocks) {
    const lines = block.split('\n').filter(l => l.trim() !== '');
    if (!lines.length) continue;

    // Ordered list: all lines start with "N." or "N)"
    const isOL = lines.every(l => /^\d+[.)]\s/.test(l.trimStart()));
    if (isOL) {
      nodes.push(
        <ol key={key++} style={{ paddingLeft: '1.4em', margin: '4px 0 8px', lineHeight: 1.7 }}>
          {lines.map((l, i) => (
            <li key={i} style={{ marginBottom: '6px' }}>
              {parseInline(l.replace(/^\d+[.)]\s*/, ''))}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Unordered list: all lines start with "- " or "• "
    const isUL = lines.every(l => /^[-•*]\s/.test(l.trimStart()));
    if (isUL) {
      nodes.push(
        <ul key={key++} style={{ paddingLeft: '1.4em', margin: '4px 0 8px', listStyleType: 'disc', lineHeight: 1.7 }}>
          {lines.map((l, i) => (
            <li key={i} style={{ marginBottom: '4px' }}>
              {parseInline(l.replace(/^[-•*]\s*/, ''))}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Mixed block: some lines may be list items, others plain text
    // Render line by line preserving structure
    const hasList = lines.some(l => /^\d+[.)]\s/.test(l.trimStart()) || /^[-•*]\s/.test(l.trimStart()));
    if (hasList) {
      const items: ReactNode[] = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^\d+[.)]\s/.test(l.trimStart())) {
          items.push(
            <li key={i} style={{ marginBottom: '6px' }}>
              {parseInline(l.replace(/^\d+[.)]\s*/, ''))}
            </li>
          );
        } else if (/^[-•*]\s/.test(l.trimStart())) {
          items.push(
            <li key={i} style={{ marginBottom: '4px' }}>
              {parseInline(l.replace(/^[-•*]\s*/, ''))}
            </li>
          );
        } else {
          items.push(
            <p key={i} style={{ margin: '4px 0' }}>
              {parseInline(l)}
            </p>
          );
        }
      }
      nodes.push(<div key={key++} style={{ margin: '4px 0 8px' }}>{items}</div>);
      continue;
    }

    // Plain paragraph (join lines with space — soft-wrap)
    nodes.push(
      <p key={key++} style={{ margin: '0 0 8px', lineHeight: 1.7 }}>
        {lines.map((l, i) => (
          <span key={i}>
            {parseInline(l)}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return nodes;
}

/* ── exported component ────────────────────────────────────────────── */
export function ChatMessage({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
        style={{
          background: isUser ? 'var(--blue-primary)' : 'var(--grey-card)',
          color: isUser ? '#fff' : 'var(--blue-primary)',
          border: isUser ? 'none' : '1px solid var(--grey-mid)',
        }}
      >
        {isUser ? 'V' : 'IA'}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[82%] rounded-xl px-4 py-3 text-sm"
        style={isUser
          ? { background: 'var(--blue-primary)', color: '#fff' }
          : { background: '#fff', border: '1px solid var(--grey-mid)', color: 'var(--grey-dark)', boxShadow: 'var(--shadow-sm)' }
        }
      >
        {isUser
          ? <p style={{ lineHeight: 1.6 }}>{content}</p>
          : <div style={{ lineHeight: 1.7 }}>{renderBlocks(content)}</div>
        }
      </div>
    </div>
  );
}

export function ThinkingBubble() {
  return (
    <div className="flex gap-3 flex-row">
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
        style={{ background: 'var(--grey-card)', color: 'var(--blue-primary)', border: '1px solid var(--grey-mid)' }}
      >
        IA
      </div>
      <div
        className="rounded-xl px-4 py-3 text-sm italic"
        style={{ background: '#fff', border: '1px solid var(--grey-mid)', color: 'var(--grey-text)', boxShadow: 'var(--shadow-sm)' }}
      >
        <span style={{ letterSpacing: '0.05em' }}>pensando</span>
        <span className="animate-pulse">…</span>
      </div>
    </div>
  );
}
