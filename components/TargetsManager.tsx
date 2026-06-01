"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Target = {
  id: string;
  name: string;
  provider: string;
  url: string;
  isActive: boolean;
  isRetryEnabled: boolean;
  maxAttempts: number;
  backoffStrategy: "none" | "fixed" | "exponential";
  backoffBaseMs: number;
  timeoutMs: number;
  retryOnStatuses: number[];
  isSignatureVerificationEnabled: boolean;
  signatureHeaderName: string | null;
  signatureAlgorithm: string | null;
  signingSecretEnvVar: string | null;
  lastReplay?: { status: string; responseStatus: number | null } | null;
};

type Errors = {
  name?: string;
  provider?: string;
  url?: string;
  retryOnStatuses?: string;
  signatureHeaderName?: string;
  signingSecretEnvVar?: string;
  form?: string;
};

type FormValues = {
  name: string;
  provider: string;
  url: string;
  isActive: boolean;
  isRetryEnabled: boolean;
  maxAttempts: number;
  backoffStrategy: "none" | "fixed" | "exponential";
  backoffBaseMs: number;
  timeoutMs: number;
  retryOnStatusesText: string;
  isSignatureVerificationEnabled: boolean;
  signatureHeaderName: string;
  signatureAlgorithm: string;
  signingSecretEnvVar: string;
};

function parseStatusList(text: string): { ok: number[]; bad: string | null } {
  if (!text.trim()) return { ok: [], bad: null };
  const parts = text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 100 || n >= 600) {
      return { ok: [], bad: p };
    }
    out.push(n);
  }
  return { ok: out, bad: null };
}

function validate(input: FormValues): Errors {
  const errs: Errors = {};
  if (!input.name.trim()) errs.name = "Name is required.";
  if (!input.provider.trim()) errs.provider = "Provider is required.";
  if (!input.url.trim()) {
    errs.url = "URL is required.";
  } else {
    try {
      const u = new URL(input.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        errs.url = "URL must start with http:// or https://";
      }
    } catch {
      errs.url = "URL is not a valid http/https URL.";
    }
  }
  const status = parseStatusList(input.retryOnStatusesText);
  if (status.bad !== null) {
    errs.retryOnStatuses = `Invalid status: ${status.bad}`;
  }
  if (input.isSignatureVerificationEnabled) {
    if (!input.signatureHeaderName.trim()) {
      errs.signatureHeaderName = "Header name is required when verification is enabled.";
    } else if (!/^[A-Za-z0-9_-]+$/.test(input.signatureHeaderName.trim())) {
      errs.signatureHeaderName = "Letters, digits, dashes, underscores only.";
    }
    if (!input.signingSecretEnvVar.trim()) {
      errs.signingSecretEnvVar = "Env var name is required when verification is enabled.";
    } else if (!/^[A-Z0-9_]+$/.test(input.signingSecretEnvVar.trim())) {
      errs.signingSecretEnvVar = "Use uppercase letters, digits, underscores.";
    }
  }
  return errs;
}

export function TargetsManager({ initial }: { initial: Target[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
          {initial.length} target{initial.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
          className="rounded border border-volt/50 bg-volt/10 px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-volt hover:bg-volt/20"
        >
          {creating ? "cancel" : "+ new target"}
        </button>
      </div>

      {creating ? (
        <TargetForm
          mode="create"
          pending={pending}
          onSubmit={async (values) => {
            setPending(true);
            try {
              const res = await fetch("/api/targets", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(values),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? `Create failed (${res.status})`);
              }
              setCreating(false);
              refresh();
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
              <th className="w-[20%] px-3 py-2 text-left">Name</th>
              <th className="w-[14%] px-3 py-2 text-left">Provider</th>
              <th className="w-[24%] px-3 py-2 text-left">URL</th>
              <th className="w-[8%] px-3 py-2 text-left">Active</th>
              <th className="w-[10%] px-3 py-2 text-left">Retry</th>
              <th className="w-[10%] px-3 py-2 text-left">Signature</th>
              <th className="w-[14%] px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((t) => {
              const editing = editingId === t.id;
              return (
                <Fragment key={t.id}>
                  <tr className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2 font-mono text-xs text-fg">{t.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-fg-muted">{t.provider}</td>
                    <td className="truncate px-3 py-2 font-mono text-xxs text-fg-subtle">
                      {t.url}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={t.isActive ? "ok" : "muted"}>
                        {t.isActive ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {t.isRetryEnabled ? (
                        <Badge tone="volt">
                          {t.maxAttempts}× {t.backoffStrategy}
                        </Badge>
                      ) : (
                        <Badge tone="muted">off</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {t.isSignatureVerificationEnabled ? (
                        <Badge tone="ok">verify</Badge>
                      ) : (
                        <Badge tone="muted">off</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xxs">
                      <button
                        onClick={async () => {
                          setPending(true);
                          try {
                            await fetch(`/api/targets/${t.id}`, {
                              method: "PATCH",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ isActive: !t.isActive }),
                            });
                            refresh();
                          } finally {
                            setPending(false);
                          }
                        }}
                        className="mr-2 rounded border border-border px-2 py-1 uppercase tracking-wider text-fg-muted hover:border-volt hover:text-volt"
                      >
                        {t.isActive ? "disable" : "enable"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(editing ? null : t.id);
                          setCreating(false);
                        }}
                        className="rounded border border-border px-2 py-1 uppercase tracking-wider text-fg-muted hover:border-volt hover:text-volt"
                      >
                        {editing ? "cancel" : "edit"}
                      </button>
                    </td>
                  </tr>
                  {editing ? (
                    <tr className="border-b border-border last:border-0 bg-bg-panel/40">
                      <td colSpan={7} className="px-3 py-3">
                        <TargetForm
                          mode="edit"
                          pending={pending}
                          initial={t}
                          onSubmit={async (values) => {
                            setPending(true);
                            try {
                              const res = await fetch(`/api/targets/${t.id}`, {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify(values),
                              });
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                throw new Error(data?.error ?? `Update failed (${res.status})`);
                              }
                              setEditingId(null);
                              refresh();
                            } finally {
                              setPending(false);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {initial.length === 0 ? (
          <div className="px-3 py-6 text-center font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            no targets — create one above
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "muted" | "volt";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-ok/40 bg-ok/10 text-ok"
      : tone === "volt"
      ? "border-volt/50 bg-volt/10 text-volt"
      : "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

function TargetForm({
  mode,
  initial,
  pending,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: Target;
  pending: boolean;
  onSubmit: (values: {
    name: string;
    provider: string;
    url: string;
    isActive: boolean;
    isRetryEnabled: boolean;
    maxAttempts: number;
    backoffStrategy: "none" | "fixed" | "exponential";
    backoffBaseMs: number;
    timeoutMs: number;
    retryOnStatuses: number[];
    isSignatureVerificationEnabled: boolean;
    signatureHeaderName?: string;
    signatureAlgorithm?: string;
    signingSecretEnvVar?: string;
  }) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>({
    name: initial?.name ?? "",
    provider: initial?.provider ?? "",
    url: initial?.url ?? "",
    isActive: initial?.isActive ?? true,
    isRetryEnabled: initial?.isRetryEnabled ?? false,
    maxAttempts: initial?.maxAttempts ?? 1,
    backoffStrategy: initial?.backoffStrategy ?? "none",
    backoffBaseMs: initial?.backoffBaseMs ?? 500,
    timeoutMs: initial?.timeoutMs ?? 15000,
    retryOnStatusesText: (initial?.retryOnStatuses ?? [500, 502, 503, 504]).join(","),
    isSignatureVerificationEnabled: initial?.isSignatureVerificationEnabled ?? false,
    signatureHeaderName: initial?.signatureHeaderName ?? "",
    signatureAlgorithm: initial?.signatureAlgorithm ?? "hmac-sha256",
    signingSecretEnvVar: initial?.signingSecretEnvVar ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});

  function patch<K extends keyof FormValues>(key: K, v: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const status = parseStatusList(values.retryOnStatusesText);
      await onSubmit({
        name: values.name.trim(),
        provider: values.provider.trim(),
        url: values.url.trim(),
        isActive: values.isActive,
        isRetryEnabled: values.isRetryEnabled,
        maxAttempts: Number(values.maxAttempts),
        backoffStrategy: values.backoffStrategy,
        backoffBaseMs: Number(values.backoffBaseMs),
        timeoutMs: Number(values.timeoutMs),
        retryOnStatuses: status.ok,
        isSignatureVerificationEnabled: values.isSignatureVerificationEnabled,
        signatureHeaderName: values.signatureHeaderName.trim() || undefined,
        signatureAlgorithm: values.signatureAlgorithm.trim() || undefined,
        signingSecretEnvVar: values.signingSecretEnvVar.trim() || undefined,
      });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Request failed" });
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
      <Field label="Name" error={errors.name}>
        <input
          value={values.name}
          onChange={(e) => patch("name", e.target.value)}
          placeholder="Stripe Internal Forwarder"
          className={inputCls}
        />
      </Field>
      <Field label="Provider" error={errors.provider}>
        <input
          value={values.provider}
          onChange={(e) => patch("provider", e.target.value)}
          placeholder="stripe-demo"
          className={inputCls}
        />
      </Field>
      <Field label="URL" error={errors.url} className="md:col-span-2">
        <input
          value={values.url}
          onChange={(e) => patch("url", e.target.value)}
          placeholder="https://example.com/hooks/stripe"
          className={inputCls}
        />
      </Field>
      <label className="flex items-center gap-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => patch("isActive", e.target.checked)}
          className="accent-volt"
        />
        active
      </label>

      {/* Retry policy block */}
      <div className="md:col-span-4 rounded border border-border bg-bg/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            retry policy
          </div>
          <label className="flex items-center gap-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
            <input
              type="checkbox"
              checked={values.isRetryEnabled}
              onChange={(e) => patch("isRetryEnabled", e.target.checked)}
              className="accent-volt"
            />
            retry enabled
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Max Attempts (1–5)">
            <input
              type="number"
              min={1}
              max={5}
              value={values.maxAttempts}
              onChange={(e) => patch("maxAttempts", Number(e.target.value))}
              className={inputCls}
              disabled={!values.isRetryEnabled}
            />
          </Field>
          <Field label="Strategy">
            <select
              value={values.backoffStrategy}
              onChange={(e) =>
                patch(
                  "backoffStrategy",
                  e.target.value as "none" | "fixed" | "exponential"
                )
              }
              className={inputCls}
              disabled={!values.isRetryEnabled}
            >
              <option value="none">none</option>
              <option value="fixed">fixed</option>
              <option value="exponential">exponential</option>
            </select>
          </Field>
          <Field label="Backoff Base (ms, 100–10000)">
            <input
              type="number"
              min={100}
              max={10000}
              value={values.backoffBaseMs}
              onChange={(e) => patch("backoffBaseMs", Number(e.target.value))}
              className={inputCls}
              disabled={!values.isRetryEnabled}
            />
          </Field>
          <Field label="Timeout (ms, 1000–30000)">
            <input
              type="number"
              min={1000}
              max={30000}
              value={values.timeoutMs}
              onChange={(e) => patch("timeoutMs", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field
            label="Retry on statuses (csv)"
            error={errors.retryOnStatuses}
            className="md:col-span-4"
          >
            <input
              value={values.retryOnStatusesText}
              onChange={(e) => patch("retryOnStatusesText", e.target.value)}
              placeholder="500,502,503,504"
              className={inputCls}
              disabled={!values.isRetryEnabled}
            />
          </Field>
        </div>
      </div>

      {/* Signature verification block */}
      <div className="md:col-span-4 rounded border border-border bg-bg/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            signature verification
          </div>
          <label className="flex items-center gap-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
            <input
              type="checkbox"
              checked={values.isSignatureVerificationEnabled}
              onChange={(e) =>
                patch("isSignatureVerificationEnabled", e.target.checked)
              }
              className="accent-volt"
            />
            verify enabled
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Header name" error={errors.signatureHeaderName}>
            <input
              value={values.signatureHeaderName}
              onChange={(e) => patch("signatureHeaderName", e.target.value)}
              placeholder="x-hub-signature-256"
              className={inputCls}
              disabled={!values.isSignatureVerificationEnabled}
            />
          </Field>
          <Field label="Algorithm">
            <select
              value={values.signatureAlgorithm}
              onChange={(e) => patch("signatureAlgorithm", e.target.value)}
              className={inputCls}
              disabled={!values.isSignatureVerificationEnabled}
            >
              <option value="hmac-sha256">hmac-sha256</option>
            </select>
          </Field>
          <Field
            label="Secret env var"
            error={errors.signingSecretEnvVar}
          >
            <input
              value={values.signingSecretEnvVar}
              onChange={(e) => patch("signingSecretEnvVar", e.target.value)}
              placeholder="STRIPE_DEMO_WEBHOOK_SECRET"
              className={inputCls}
              disabled={!values.isSignatureVerificationEnabled}
            />
          </Field>
        </div>
        <div className="mt-2 font-mono text-xxs text-fg-subtle">
          The secret is read from process.env at request time. It is never
          stored in the database or returned to the client.
        </div>
      </div>

      <div className="md:col-span-4 flex items-center justify-end gap-2">
        {errors.form ? (
          <span className="font-mono text-xxs text-danger">{errors.form}</span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-volt/50 bg-volt/10 px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-volt hover:bg-volt/20 disabled:opacity-50"
        >
          {pending ? "saving…" : mode === "create" ? "create target" : "save changes"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg placeholder:text-fg-subtle focus:border-volt focus:outline-none disabled:opacity-50";

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        {label}
      </div>
      {children}
      {error ? (
        <div className="mt-1 font-mono text-xxs text-danger">{error}</div>
      ) : null}
    </div>
  );
}
