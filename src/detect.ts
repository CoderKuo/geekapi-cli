import { homedir } from "node:os";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { run, commandExists } from "./utils";

export interface ToolStatus {
  installed: boolean;
  version?: string;
  path?: string;
  detectedBy?: "cli" | "config";
}

export interface Environment {
  claude: ToolStatus;
  codex: ToolStatus;
  node: ToolStatus;
  bun: ToolStatus;
  npm: ToolStatus;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function tryCmd(cmd: string, versionArg = "--version"): Promise<ToolStatus | null> {
  if (!(await commandExists(cmd))) return null;
  const r = await run([cmd, versionArg]);
  const version = r.ok ? r.stdout.split(/\r?\n/)[0]?.trim() : undefined;
  return { installed: true, version, detectedBy: "cli" };
}

async function check(cmd: string, versionArg = "--version"): Promise<ToolStatus> {
  return (await tryCmd(cmd, versionArg)) ?? { installed: false };
}

async function checkCodex(): Promise<ToolStatus> {
  for (const name of ["codex", "codex-cli", "openai-codex"]) {
    const found = await tryCmd(name);
    if (found) return found;
  }
  if (await dirExists(join(homedir(), ".codex"))) {
    return { installed: true, version: "已检测到 ~/.codex 配置", detectedBy: "config" };
  }
  return { installed: false };
}

async function checkClaude(): Promise<ToolStatus> {
  return (await tryCmd("claude")) ?? { installed: false };
}

export async function detectEnvironment(): Promise<Environment> {
  const [claude, codex, node, bun, npm] = await Promise.all([
    checkClaude(),
    checkCodex(),
    check("node"),
    check("bun"),
    check("npm"),
  ]);
  return { claude, codex, node, bun, npm };
}
