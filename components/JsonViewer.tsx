"use client";

import { useMemo, useState } from "react";

type JsonViewerProps = {
  value: unknown;
  /** Hide the toolbar (search/expand). */
  compact?: boolean;
  /** Max characters allowed to render before truncation warning shown. */
  maxChars?: number;
};

export function JsonViewer({
  value,
  compact = false,
  maxChars = 200_000,
}: JsonViewerProps) {
  const [query, setQuery] = useState("");

  const json = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const tooLarge = json.length > maxChars;
  const displayed = tooLarge ? json.slice(0, maxChars) : json;

  const highlighted = useMemo(() => {
    if (!query.trim()) return null;
    try {
      const re = new RegExp(escapeRegex(query), "gi");
      const parts = displayed.split(re);
      const matches = displayed.match(re) ?? [];
      const out: Array<{ text: string; match: boolean }> = [];
      parts.forEach((p, i) => {
        out.push({ text: p, match: false });
        if (i < matches.length) out.push({ text: matches[i], match: true });
      });
      return out;
    } catch {
      return null;
    }
  }, [displayed, query]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // ignored
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-panel">
      {!compact ? (
        <div className="flex items-center gap-2 border-b border-border bg-bg-elevated px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter…"
            className="w-full max-w-xs rounded border border-border bg-bg px-2 py-1 font-mono text-xxs text-fg placeholder:text-fg-subtle focus:border-volt focus:outline-none"
          />
          <span className="font-mono text-xxs text-fg-subtle">
            {json.length.toLocaleString()} chars
          </span>
          <div className="flex-1" />
          <button
            onClick={copy}
            className="rounded border border-border bg-bg px-2 py-1 font-mono text-xxs uppercase tracking-wider text-fg-muted hover:border-volt hover:text-volt"
          >
            copy
          </button>
        </div>
      ) : null}

      <pre className="max-h-[60vh] overflow-auto p-3 font-mono text-xs leading-relaxed text-fg">
        {highlighted ? (
          highlighted.map((p, i) =>
            p.match ? (
              <mark key={i} className="rounded bg-volt/30 px-0.5 text-volt">
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )
        ) : (
          <code>{displayed}</code>
        )}
        {tooLarge ? (
          <div className="mt-2 rounded border border-warn/40 bg-warn/10 px-2 py-1 text-warn">
            payload truncated for display ({json.length.toLocaleString()} chars total)
          </div>
        ) : null}
      </pre>
    </div>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
