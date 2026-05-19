import { platform, arch } from "node:os";

export type OS = "windows" | "macos" | "linux";

export const OS_NAME: OS =
  platform() === "win32" ? "windows" : platform() === "darwin" ? "macos" : "linux";

export const ARCH = arch();

export const IS_WIN = OS_NAME === "windows";
export const IS_MAC = OS_NAME === "macos";
export const IS_LINUX = OS_NAME === "linux";

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

export async function run(
  cmd: string[],
  opts: { cwd?: string; env?: Record<string, string>; shell?: boolean } = {},
): Promise<CommandResult> {
  try {
    const command = opts.shell && IS_WIN ? ["cmd", "/c", ...cmd] : cmd;
    const proc = Bun.spawn(command, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env } as Record<string, string>,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    return { ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), code };
  } catch (err) {
    return { ok: false, stdout: "", stderr: String(err), code: -1 };
  }
}

export async function runStreaming(
  cmd: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<boolean> {
  const command = IS_WIN ? ["cmd", "/c", ...cmd] : cmd;
  const proc = Bun.spawn(command, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env } as Record<string, string>,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const code = await proc.exited;
  return code === 0;
}

export async function commandExists(name: string): Promise<boolean> {
  const probe = IS_WIN ? ["where", name] : ["sh", "-c", `command -v ${name}`];
  const r = await run(probe);
  return r.ok && r.stdout.length > 0;
}
