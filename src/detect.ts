import { run, commandExists } from "./utils";

export interface ToolStatus {
  installed: boolean;
  version?: string;
  path?: string;
}

export interface Environment {
  claude: ToolStatus;
  codex: ToolStatus;
  node: ToolStatus;
  bun: ToolStatus;
  npm: ToolStatus;
}

async function check(cmd: string, versionArg = "--version"): Promise<ToolStatus> {
  const exists = await commandExists(cmd);
  if (!exists) return { installed: false };
  const r = await run([cmd, versionArg]);
  if (!r.ok) return { installed: true };
  const version = r.stdout.split(/\r?\n/)[0]?.trim();
  return { installed: true, version };
}

export async function detectEnvironment(): Promise<Environment> {
  const [claude, codex, node, bun, npm] = await Promise.all([
    check("claude"),
    check("codex"),
    check("node"),
    check("bun"),
    check("npm"),
  ]);
  return { claude, codex, node, bun, npm };
}
