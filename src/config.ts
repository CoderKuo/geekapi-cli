import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, stat } from "node:fs/promises";
import { atomicWrite, rotateBackup } from "./utils";

export const CLAUDE_DIR = join(homedir(), ".claude");
export const SETTINGS_PATH = join(CLAUDE_DIR, "settings.json");

export interface ClaudeSettings {
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface ApiConfig {
  baseUrl: string;
  authToken: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function readSettings(): Promise<ClaudeSettings> {
  if (!(await fileExists(SETTINGS_PATH))) return {};
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err) {
    throw new Error(
      `读取 ${SETTINGS_PATH} 失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function applyApiConfig(cfg: ApiConfig): Promise<{
  before: ClaudeSettings;
  after: ClaudeSettings;
  backup: string | null;
}> {
  const before = await readSettings();

  const after: ClaudeSettings = {
    ...before,
    env: {
      ...(before.env ?? {}),
      ANTHROPIC_BASE_URL: cfg.baseUrl,
      ANTHROPIC_AUTH_TOKEN: cfg.authToken,
    },
  };

  await mkdir(CLAUDE_DIR, { recursive: true });
  const backup = await rotateBackup(SETTINGS_PATH);
  await atomicWrite(SETTINGS_PATH, JSON.stringify(after, null, 2) + "\n");

  return { before, after, backup };
}

export function maskToken(token: string): string {
  if (token.length <= 10) return "*".repeat(token.length);
  return `${token.slice(0, 6)}${"*".repeat(token.length - 10)}${token.slice(-4)}`;
}
