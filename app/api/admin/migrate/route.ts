import { NextRequest, NextResponse } from "next/server";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One-shot migration endpoint. Runs all SQL files under prisma/migrations
 * against the configured DATABASE_URL via Neon's HTTP driver.
 *
 * Protected by ?token=<MIGRATION_TOKEN>. Safe to call multiple times — any
 * "already exists" errors are skipped.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.MIGRATION_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL_missing" }, { status: 500 });
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const log: string[] = [];

  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    log.push(`[migrate] ${dir}`);
    const file = join(migrationsDir, dir, "migration.sql");
    const content = readFileSync(file, "utf8");
    const cleaned = content
      .split("\n")
      .map((line) => (line.trim().startsWith("--") ? "" : line))
      .join("\n");
    const statements = cleaned
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      const preview = (stmt.split("\n").find((l) => l.trim()) ?? "").slice(0, 80);
      try {
        await pool.query(stmt + ";");
        log.push(`  ok   ${preview}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(msg)) {
          log.push(`  skip ${preview}`);
        } else {
          log.push(`  FAIL ${preview} :: ${msg}`);
          await pool.end();
          return NextResponse.json({ ok: false, log }, { status: 500 });
        }
      }
    }
  }

  await pool.end();
  return NextResponse.json({ ok: true, log });
}
