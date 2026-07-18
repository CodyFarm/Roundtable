import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");

// ── Database client ───────────────────────────────────────────────────
// Uses Turso cloud if TURSO_DATABASE_URL is configured,
// otherwise falls back to a local SQLite file.

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

let db: Client;

if (tursoUrl && tursoToken) {
  db = createClient({ url: tursoUrl, authToken: tursoToken });
} else {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  db = createClient({ url: `file:${path.join(DATA_DIR, "philo.db")}` });
}

// ── Schema initialization ─────────────────────────────────────────────

async function initSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invitation_codes (
      code TEXT PRIMARY KEY,
      used_by TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shared_philosophers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      philosopher_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shared_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      session_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

// ── Seed invitation codes ─────────────────────────────────────────────
// On first run, import existing codes from data/invitation_codes.json

async function seedInvitationCodes(): Promise<void> {
  const result = await db.execute(
    "SELECT COUNT(*) as count FROM invitation_codes"
  );
  if (result.rows[0] && Number(result.rows[0].count) > 0) return;

  const jsonPath = path.join(DATA_DIR, "invitation_codes.json");
  if (!fs.existsSync(jsonPath)) return;

  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(raw);
    const codes: Array<{ code: string; usedBy: string | null; createdAt: string }> =
      data.codes || [];
    for (const entry of codes) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO invitation_codes (code, used_by, created_at) VALUES (?, ?, ?)",
        args: [entry.code, entry.usedBy || null, entry.createdAt],
      });
    }
  } catch (err) {
    console.error("Failed to seed invitation codes:", err);
  }
}

// Run at module load time (top-level await, ESM)
await initSchema();
await seedInvitationCodes();

// ── Invitation Codes ──────────────────────────────────────────────────

export async function findInvitationCode(
  code: string
): Promise<{ code: string; usedBy: string | null; createdAt: string } | undefined> {
  const result = await db.execute({
    sql: "SELECT * FROM invitation_codes WHERE code = ? AND used_by IS NULL",
    args: [code],
  });
  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];
  return {
    code: row.code as string,
    usedBy: row.used_by as string | null,
    createdAt: row.created_at as string,
  };
}

export async function markInvitationCodeUsed(
  code: string,
  username: string
): Promise<boolean> {
  const result = await db.execute({
    sql: "UPDATE invitation_codes SET used_by = ? WHERE code = ? AND used_by IS NULL",
    args: [username, code],
  });
  return result.rowsAffected > 0;
}

export async function releaseInvitationCode(username: string): Promise<boolean> {
  const result = await db.execute({
    sql: "UPDATE invitation_codes SET used_by = NULL WHERE used_by = ?",
    args: [username],
  });
  return result.rowsAffected > 0;
}

// ── Users ─────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export async function findUserByUsername(
  username: string
): Promise<StoredUser | undefined> {
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username],
  });
  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];
  return {
    id: row.id as string,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    salt: row.salt as string,
    createdAt: row.created_at as string,
  };
}

export async function saveUser(user: StoredUser): Promise<void> {
  await db.execute({
    sql: "INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [user.id, user.username, user.passwordHash, user.salt, user.createdAt],
  });
}

export async function deleteUser(userId: string): Promise<boolean> {
  const result = await db.execute({
    sql: "DELETE FROM users WHERE id = ?",
    args: [userId],
  });
  return result.rowsAffected > 0;
}

// ── Auth Tokens ───────────────────────────────────────────────────────

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TokenEntry {
  token: string;
  userId: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}

export async function createToken(
  userId: string,
  username: string
): Promise<TokenEntry> {
  const token = crypto.randomUUID();
  const now = new Date();
  const entry: TokenEntry = {
    token,
    userId,
    username,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS).toISOString(),
  };
  await db.execute({
    sql: "INSERT INTO tokens (token, user_id, username, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    args: [entry.token, entry.userId, entry.username, entry.createdAt, entry.expiresAt],
  });
  return entry;
}

export async function findToken(
  token: string
): Promise<TokenEntry | undefined> {
  const result = await db.execute({
    sql: "SELECT * FROM tokens WHERE token = ?",
    args: [token],
  });
  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];
  const entry: TokenEntry = {
    token: row.token as string,
    userId: row.user_id as string,
    username: row.username as string,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  };
  // Check expiry
  if (new Date(entry.expiresAt) < new Date()) {
    await db.execute({ sql: "DELETE FROM tokens WHERE token = ?", args: [token] });
    return undefined;
  }
  return entry;
}

export async function deleteUserTokens(userId: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM tokens WHERE user_id = ?", args: [userId] });
}

// ── Shared Philosophers ───────────────────────────────────────────────

export interface StoredSharedPhilosopher {
  id: string;
  userId: string;
  username: string;
  philosopher: unknown;
  createdAt: string;
}

export async function getSharedPhilosophers(): Promise<StoredSharedPhilosopher[]> {
  const result = await db.execute(
    "SELECT * FROM shared_philosophers ORDER BY created_at DESC"
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    username: row.username as string,
    philosopher: JSON.parse(row.philosopher_json as string),
    createdAt: row.created_at as string,
  }));
}

export async function saveSharedPhilosopher(
  entry: StoredSharedPhilosopher
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO shared_philosophers (id, user_id, username, philosopher_json, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [
      entry.id,
      entry.userId,
      entry.username,
      JSON.stringify(entry.philosopher),
      entry.createdAt,
    ],
  });
}

export async function deleteSharedPhilosopher(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db.execute({
    sql: "DELETE FROM shared_philosophers WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return result.rowsAffected > 0;
}

export async function deleteSharedPhilosophersByUser(
  userId: string
): Promise<number> {
  const result = await db.execute({
    sql: "DELETE FROM shared_philosophers WHERE user_id = ?",
    args: [userId],
  });
  return result.rowsAffected;
}

// ── Shared Sessions ───────────────────────────────────────────────────

export interface StoredSharedSession {
  id: string;
  userId: string;
  username: string;
  session: unknown;
  createdAt: string;
}

export async function getSharedSessions(): Promise<StoredSharedSession[]> {
  const result = await db.execute(
    "SELECT * FROM shared_sessions ORDER BY created_at DESC"
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    username: row.username as string,
    session: JSON.parse(row.session_json as string),
    createdAt: row.created_at as string,
  }));
}

export async function saveSharedSession(
  entry: StoredSharedSession
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO shared_sessions (id, user_id, username, session_json, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [
      entry.id,
      entry.userId,
      entry.username,
      JSON.stringify(entry.session),
      entry.createdAt,
    ],
  });
}

export async function deleteSharedSession(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db.execute({
    sql: "DELETE FROM shared_sessions WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return result.rowsAffected > 0;
}

export async function deleteSharedSessionsByUser(
  userId: string
): Promise<number> {
  const result = await db.execute({
    sql: "DELETE FROM shared_sessions WHERE user_id = ?",
    args: [userId],
  });
  return result.rowsAffected;
}
