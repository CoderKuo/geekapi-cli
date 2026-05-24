import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, copyFile, stat } from "node:fs/promises";

export const CODEX_DIR = join(homedir(), ".codex");
export const CODEX_CONFIG_PATH = join(CODEX_DIR, "config.toml");
export const CODEX_AUTH_PATH = join(CODEX_DIR, "auth.json");

export interface CodexConfig {
  baseUrl: string;
  apiKey: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function buildConfigToml(baseUrl: string): string {
  return `model_provider = "OpenAI"
model = "gpt-5.5"
review_model = "gpt-5.5"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
name = "OpenAI"
base_url = "${baseUrl}"
wire_api = "responses"
requires_openai_auth = true
`;
}

export async function applyCodexConfig(cfg: CodexConfig): Promise<{
  configBackup: string | null;
  authBackup: string | null;
}> {
  await mkdir(CODEX_DIR, { recursive: true });

  let configBackup: string | null = null;
  let authBackup: string | null = null;

  if (await fileExists(CODEX_CONFIG_PATH)) {
    await copyFile(CODEX_CONFIG_PATH, `${CODEX_CONFIG_PATH}.bak`);
    configBackup = `${CODEX_CONFIG_PATH}.bak`;
  }
  if (await fileExists(CODEX_AUTH_PATH)) {
    await copyFile(CODEX_AUTH_PATH, `${CODEX_AUTH_PATH}.bak`);
    authBackup = `${CODEX_AUTH_PATH}.bak`;
  }

  await writeFile(CODEX_CONFIG_PATH, buildConfigToml(cfg.baseUrl), "utf8");
  await writeFile(
    CODEX_AUTH_PATH,
    JSON.stringify({ OPENAI_API_KEY: cfg.apiKey }, null, 2) + "\n",
    "utf8",
  );

  return { configBackup, authBackup };
}

export interface CodexAuth {
  OPENAI_API_KEY?: string;
  [key: string]: unknown;
}

export async function readCodexAuth(): Promise<CodexAuth | null> {
  if (!(await fileExists(CODEX_AUTH_PATH))) return null;
  try {
    const raw = await readFile(CODEX_AUTH_PATH, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as CodexAuth;
  } catch {
    return null;
  }
}

export async function readCodexConfigToml(): Promise<string | null> {
  if (!(await fileExists(CODEX_CONFIG_PATH))) return null;
  return readFile(CODEX_CONFIG_PATH, "utf8");
}

export function extractBaseUrl(toml: string): string | null {
  const m = toml.match(/^\s*base_url\s*=\s*"([^"]+)"/m);
  return m ? m[1]! : null;
}
