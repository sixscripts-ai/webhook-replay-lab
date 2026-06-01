"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Target = {
  id: string;
  name: string;
  provider: string;
  url: string;
  isActive: boolean;
  lastReplay?: { status: string; responseStatus: number | null } | null;
};

type Errors = { name?: string; provider?: string; url?: string; form?: string };

function validate(input: { name: string; provider: string; url: string }): Errors {
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
              <th className="w-[22%] px-3 py-2 text-left">Name</th>
              <th className="w-[16%] px-3 py-2 text-left">Provider</th>
              <th className="w-[28%] px-3 py-2 text-left">URL</th>
              <th className="w-[10%] px-3 py-2 text-left">Active</th>
              <th className="w-[12%] px-3 py-2 text-left">Last Replay</th>
              <th className="w-[12%] px-3 py-2 text-right">Actions</th>
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
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${
                          t.isActive
                            ? "border-ok/40 bg-ok/10 text-ok"
                            : "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted"
                        }`}
                      >
                        {t.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                      {t.lastReplay
                        ? `${t.lastReplay.status} · ${t.lastReplay.responseStatus ?? "—"}`
                        : "—"}
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
                      <td colSpan={6} className="px-3 py-3">
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

function TargetForm({
  mode,
  initial,
  pending,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: { name: string; provider: string; url: string; isActive: boolean };
  pending: boolean;
  onSubmit: (values: {
    name: string;
    provider: string;
    url: string;
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [errors, setErrors] = useState<Errors>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate({ name, provider, url });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await onSubmit({ name: name.trim(), provider: provider.trim(), url: url.trim(), isActive });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Request failed" });
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
      <Field label="Name" error={errors.name}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Stripe Internal Forwarder"
          className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg placeholder:text-fg-subtle focus:border-volt focus:outline-none"
        />
      </Field>
      <Field label="Provider" error={errors.provider}>
        <input
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="stripe-demo"
          className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg placeholder:text-fg-subtle focus:border-volt focus:outline-none"
        />
      </Field>
      <Field label="URL" error={errors.url} className="md:col-span-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/hooks/stripe"
          className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg placeholder:text-fg-subtle focus:border-volt focus:outline-none"
        />
      </Field>
      <label className="flex items-center gap-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="accent-volt"
        />
        active
      </label>
      <div className="md:col-span-3 flex items-center justify-end gap-2">
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
