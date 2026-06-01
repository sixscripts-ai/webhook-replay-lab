import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        404 · event not found
      </div>
      <h1 className="font-mono text-xl text-fg">No event with that ID</h1>
      <Link
        href="/events"
        className="rounded border border-volt/50 bg-volt/10 px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-volt hover:bg-volt/20"
      >
        ← back to inbox
      </Link>
    </div>
  );
}
