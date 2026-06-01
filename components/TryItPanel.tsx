"use client";

import { useState } from "react";

const CURL_COMMAND = `curl -X POST https://webhookreplay-lab.vercel.app/api/webhooks/stripe-demo \\
  -H "Content-Type: application/json" \\
  -H "x-event-type: payment.failed" \\
  -d '{"id":"evt_demo_001","type":"payment.failed","amount":4200,"customer":"cus_demo"}'`;

export function TryItPanel() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CURL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignored
    }
  }

  return (
    <div className="flex min-w-0 flex-col rounded-md border border-border bg-bg-elevated">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
          try it · capture a webhook
        </div>
        <button
          onClick={copy}
          className="shrink-0 rounded border border-border bg-bg px-2 py-1 font-mono text-xxs uppercase tracking-wider text-fg-muted hover:border-volt hover:text-volt"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <pre className="whitespace-pre px-4 py-4 font-mono text-xs leading-relaxed text-fg">
          <code>{CURL_COMMAND}</code>
        </pre>
      </div>
      <div className="border-t border-border bg-bg-panel/40 px-4 py-3 font-mono text-xxs text-fg-muted">
        Send this request, then refresh the Events page to see the captured webhook.
      </div>
    </div>
  );
}
