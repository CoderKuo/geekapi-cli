import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, copyFile, stat } from "node:fs/promises";

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

export async function writeSettings(settings: ClaudeSettings): Promise<void> {
  await mkdir(CLAUDE_DIR, { recursive: true });
  if (await fileExists(SETTINGS_PATH)) {
    await copyFile(SETTINGS_PATH, `${SETTINGS_PATH}.bak`);
  }
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

export async function applyApiConfig(cfg: ApiConfig): Promise<{
  before: ClaudeSettings;
  after: ClaudeSettings;
  backup: string | null;
}> {
  const before = await readSettings();
  const backup = (await fileExists(SETTINGS_PATH)) ? `${SETTINGS_PATH}.bak` : null;

  const after: ClaudeSettings = {
    ...before,
    env: {
      ...(before.env ?? {}),
      ANTHROPIC_BASE_URL: cfg.baseUrl,
      ANTHROPIC_AUTH_TOKEN: cfg.authToken,
    },
  };

  await writeSettings(after);
  return { before, after, backup };
}

export function maskToken(token: string): string {
  if (token.length <= 10) return "*".repeat(token.length);
  return `${token.slice(0, 6)}${"*".repeat(token.length - 10)}${token.slice(-4)}`;
}
