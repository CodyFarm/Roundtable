import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

function resolvePath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

function readJSON<T>(filename: string): T {
  const filePath = resolvePath(filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [] as unknown as T;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function writeJSON(filename: string, data: unknown): void {
  const filePath = resolvePath(filename);
  // Use a temp file + rename for atomicity on POSIX; on Windows this is still safer than direct write
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

// ── Invitation Codes ────────────────────────────────────────────────

interface InvitationCode {
  code: string;
  usedBy: string | null;
  createdAt: string;
}

export function getInvitationCodes(): InvitationCode[] {
  const data = readJSON<{ codes: InvitationCode[] }>("invitation_codes.json");
  return data.codes || [];
}

export function findInvitationCode(code: string): InvitationCode | undefined {
  return getInvitationCodes().find((c) => c.code === code && !c.usedBy);
}

export function markInvitationCodeUsed(code: string, username: string): boolean {
  const data = readJSON<{ codes: InvitationCode[] }>("invitation_codes.json");
  const entry = (data.codes || []).find((c) => c.code === code && !c.usedBy);
  if (!entry) return false;
  entry.usedBy = username;
  writeJSON("invitation_codes.json", data);
  return true;
}

// ── Users ────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export function getUsers(): StoredUser[] {
  return readJSON<StoredUser[]>("users.json");
}

export function findUserByUsername(username: string): StoredUser | undefined {
  return getUsers().find((u) => u.username === username);
}

export function saveUser(user: StoredUser): void {
  const users = getUsers();
  users.push(user);
  writeJSON("users.json", users);
}

// ── Auth Tokens ──────────────────────────────────────────────────

interface TokenEntry {
  token: string;
  userId: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createToken(userId: string, username: string): TokenEntry {
  const tokens = readJSON<TokenEntry[]>("tokens.json");
  // Generate random token
  const token =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const now = new Date();
  const entry: TokenEntry = {
    token,
    userId,
    username,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS).toISOString(),
  };
  tokens.push(entry);
  writeJSON("tokens.json", tokens);
  return entry;
}

export function findToken(token: string): TokenEntry | undefined {
  const tokens = readJSON<TokenEntry[]>("tokens.json");
  const entry = tokens.find((t) => t.token === token);
  if (!entry) return undefined;
  // Check expiry
  if (new Date(entry.expiresAt) < new Date()) {
    // Remove expired token
    const filtered = tokens.filter((t) => t.token !== token);
    writeJSON("tokens.json", filtered);
    return undefined;
  }
  return entry;
}

// ── Shared Philosophers ────────────────────────────────────────

export interface StoredSharedPhilosopher {
  id: string;
  userId: string;
  username: string;
  philosopher: unknown; // Philosopher type
  createdAt: string;
}

export function getSharedPhilosophers(): StoredSharedPhilosopher[] {
  return readJSON<StoredSharedPhilosopher[]>("shared_philosophers.json");
}

export function saveSharedPhilosopher(entry: StoredSharedPhilosopher): void {
  const list = getSharedPhilosophers();
  list.push(entry);
  writeJSON("shared_philosophers.json", list);
}

export function deleteSharedPhilosopher(id: string, userId: string): boolean {
  const list = getSharedPhilosophers();
  const idx = list.findIndex((p) => p.id === id && p.userId === userId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  writeJSON("shared_philosophers.json", list);
  return true;
}

// ── Shared Sessions ─────────────────────────────────────────────

export interface StoredSharedSession {
  id: string;
  userId: string;
  username: string;
  session: unknown; // SavedSession type
  createdAt: string;
}

export function getSharedSessions(): StoredSharedSession[] {
  return readJSON<StoredSharedSession[]>("shared_sessions.json");
}

export function saveSharedSession(entry: StoredSharedSession): void {
  const list = getSharedSessions();
  list.push(entry);
  writeJSON("shared_sessions.json", list);
}

export function deleteSharedSession(id: string, userId: string): boolean {
  const list = getSharedSessions();
  const idx = list.findIndex((s) => s.id === id && s.userId === userId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  writeJSON("shared_sessions.json", list);
  return true;
}
