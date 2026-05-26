import { platform, arch } from "node:os";
import { writeFile, rename, copyFile, stat, readdir, unlink } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { spawn } from "node:child_process";

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

export function run(
  cmd: string[],
  opts: { cwd?: string; env?: Record<string, string>; shell?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    try {
      const [bin, ...args] =
        opts.shell && IS_WIN ? ["cmd", "/c", ...cmd] : cmd;
      if (!bin) {
        resolve({ ok: false, stdout: "", stderr: "empty command", code: -1 });
        return;
      }
      const child = spawn(bin, args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (err) => {
        resolve({ ok: false, stdout: "", stderr: String(err), code: -1 });
      });
      child.on("close", (code) => {
        const exit = code ?? -1;
        resolve({
          ok: exit === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code: exit,
        });
      });
    } catch (err) {
      resolve({ ok: false, stdout: "", stderr: String(err), code: -1 });
    }
  });
}

export function runStreaming(
  cmd: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const [bin, ...args] = IS_WIN ? ["cmd", "/c", ...cmd] : cmd;
    if (!bin) {
      resolve(false);
      return;
    }
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

export async function commandExists(name: string): Promise<boolean> {
  const probe = IS_WIN ? ["where", name] : ["sh", "-c", `command -v ${name}`];
  const r = await run(probe);
  return r.ok && r.stdout.length > 0;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * 原子写入：先写到 .tmp.<ts>，再 rename 覆盖。同一文件系统下 rename 是原子的，
 * 中途崩溃不会留下半截内容的目标文件。
 */
export async function atomicWrite(path: string, data: string): Promise<void> {
  const tmp = `${path}.tmp.${Date.now()}.${process.pid}`;
  try {
    await writeFile(tmp, data, "utf8");
    await rename(tmp, path);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      // 临时文件清理失败不影响主流程
    }
    throw err;
  }
}

/**
 * 在写入前把现有文件备份成 path.bak.<timestamp>，并清理超过 keep 份的旧备份。
 * 如果原文件不存在则跳过，返回新备份路径或 null。
 */
export async function rotateBackup(
  path: string,
  keep = 5,
): Promise<string | null> {
  if (!(await fileExists(path))) return null;

  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const backup = `${path}.bak.${ts}`;
  await copyFile(path, backup);

  const dir = dirname(path);
  const prefix = `${basename(path)}.bak.`;
  try {
    const entries = await readdir(dir);
    const backups = entries
      .filter((n) => n.startsWith(prefix))
      .map((n) => join(dir, n))
      .sort();
    const excess = backups.length - keep;
    if (excess > 0) {
      await Promise.all(backups.slice(0, excess).map((p) => unlink(p).catch(() => {})));
    }
  } catch {
    // 列目录失败不影响备份本身
  }

  return backup;
}

/**
 * 用系统默认浏览器打开 URL。Windows 用 start，macOS 用 open，Linux 用 xdg-open。
 */
export async function openUrl(url: string): Promise<boolean> {
  const [bin, ...args] = IS_WIN
    ? ["cmd", "/c", "start", "", url]
    : IS_MAC
    ? ["open", url]
    : ["xdg-open", url];
  if (!bin) return false;
  try {
    const child = spawn(bin, args, {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    child.unref();
    child.on("error", () => {});
    return true;
  } catch {
    return false;
  }
}
