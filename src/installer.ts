import * as p from "@clack/prompts";
import pc from "picocolors";
import { IS_WIN, IS_MAC, IS_LINUX, run, runStreaming, commandExists } from "./utils";

const NODE_DOWNLOAD_URL = "https://nodejs.org/en/download";
const BUN_DOWNLOAD_URL = "https://bun.sh";
const CLAUDE_PACKAGE = "@anthropic-ai/claude-code";
const CODEX_PACKAGE = "@openai/codex";
const NPM_OFFICIAL = "https://registry.npmjs.org";
const NPM_MIRROR = "https://registry.npmmirror.com";

async function checkRegistry(url: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    return r.ok || r.status === 405;
  } catch {
    return false;
  }
}

async function runInstall(
  manager: "npm" | "bun",
  pkg: string,
  registry: string | null,
): Promise<boolean> {
  const base =
    manager === "npm"
      ? ["npm", "install", "-g", pkg]
      : ["bun", "add", "-g", pkg];
  const cmd = registry ? [...base, `--registry=${registry}`] : base;
  p.log.info(`即将运行：${pc.cyan(cmd.join(" "))}`);
  return runStreaming(cmd);
}

export async function ensureNodeOrBun(): Promise<{
  manager: "npm" | "bun";
  ok: boolean;
}> {
  const hasNpm = await commandExists("npm");
  if (hasNpm) return { manager: "npm", ok: true };

  const hasBun = await commandExists("bun");
  if (hasBun) return { manager: "bun", ok: true };

  p.log.warn("未检测到 Node.js（npm）或 Bun，需要先安装一个 JavaScript 运行时。");

  const choice = await p.select({
    message: "选择要安装的运行时：",
    options: [
      { value: "node", label: "Node.js（官方推荐，体积稍大）" },
      { value: "bun", label: "Bun（更快、单文件，国内访问可能慢）" },
      { value: "manual", label: "我自己装，先退出" },
    ],
    initialValue: "node",
  });

  if (p.isCancel(choice) || choice === "manual") {
    p.log.info(`Node.js 下载：${NODE_DOWNLOAD_URL}`);
    p.log.info(`Bun 下载：${BUN_DOWNLOAD_URL}`);
    return { manager: "npm", ok: false };
  }

  if (choice === "node") {
    const ok = await installNode();
    return { manager: "npm", ok };
  }

  const ok = await installBun();
  return { manager: "bun", ok };
}

async function installNode(): Promise<boolean> {
  const s = p.spinner();

  if (IS_WIN) {
    if (await commandExists("winget")) {
      s.start("通过 winget 安装 Node.js LTS（可能弹出 UAC，请允许）");
      s.stop();
      const ok = await runStreaming([
        "winget",
        "install",
        "-e",
        "--id",
        "OpenJS.NodeJS.LTS",
        "--accept-source-agreements",
        "--accept-package-agreements",
      ]);
      if (ok) {
        p.log.success("Node.js 安装完成。请关闭并重新打开本工具，让 PATH 生效。");
        return true;
      }
      p.log.error("winget 安装失败，请手动下载安装：" + NODE_DOWNLOAD_URL);
      return false;
    }
    p.log.warn("未检测到 winget，无法自动安装。请前往：" + NODE_DOWNLOAD_URL);
    return false;
  }

  if (IS_MAC) {
    if (await commandExists("brew")) {
      s.start("通过 Homebrew 安装 Node.js");
      s.stop();
      const ok = await runStreaming(["brew", "install", "node"]);
      if (ok) {
        p.log.success("Node.js 安装完成。");
        return true;
      }
      return false;
    }
    p.log.warn("未检测到 Homebrew。请前往：" + NODE_DOWNLOAD_URL);
    return false;
  }

  if (IS_LINUX) {
    p.log.info("Linux 发行版较多，建议用包管理器安装：");
    p.log.message("  Debian/Ubuntu: " + pc.cyan("sudo apt install -y nodejs npm"));
    p.log.message("  Fedora/RHEL:   " + pc.cyan("sudo dnf install -y nodejs"));
    p.log.message("  Arch:          " + pc.cyan("sudo pacman -S nodejs npm"));
    p.log.message("  或用 nvm: " + pc.cyan("https://github.com/nvm-sh/nvm"));
    return false;
  }

  return false;
}

async function installBun(): Promise<boolean> {
  if (IS_WIN) {
    p.log.info("即将运行：" + pc.cyan('powershell -c "irm bun.sh/install.ps1 | iex"'));
    const ok = await runStreaming([
      "powershell",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "irm bun.sh/install.ps1 | iex",
    ]);
    if (ok) {
      p.log.success("Bun 安装完成。请关闭并重新打开本工具，让 PATH 生效。");
      return true;
    }
    p.log.error("Bun 安装失败，请手动安装：" + BUN_DOWNLOAD_URL);
    return false;
  }

  p.log.info("即将运行：" + pc.cyan("curl -fsSL https://bun.sh/install | bash"));
  const ok = await runStreaming(["bash", "-c", "curl -fsSL https://bun.sh/install | bash"]);
  if (ok) {
    p.log.success("Bun 安装完成。请重启 shell 或 source 配置文件后再用本工具。");
    return true;
  }
  p.log.error("Bun 安装失败，请手动安装：" + BUN_DOWNLOAD_URL);
  return false;
}

export async function installNpmPackage(
  manager: "npm" | "bun",
  pkg: string,
  displayName: string,
): Promise<boolean> {
  const s = p.spinner();
  s.start("检测 npm 官方源连通性");
  const officialOk = await checkRegistry(NPM_OFFICIAL);
  s.stop(officialOk ? pc.green("npm 官方源可达") : pc.yellow("npm 官方源不可达"));

  let registry: string | null = null;

  if (!officialOk) {
    s.start("检测 npmmirror 国内镜像连通性");
    const mirrorOk = await checkRegistry(NPM_MIRROR);
    s.stop(mirrorOk ? pc.green("npmmirror 镜像可达") : pc.red("npmmirror 镜像也不可达"));

    if (!mirrorOk) {
      p.log.error("两个源都连不上，请检查网络后重试。");
      return false;
    }

    const useMirror = await p.confirm({
      message: `连不上 npm 官方源，切到 ${pc.cyan(NPM_MIRROR)} 镜像重试？`,
      initialValue: true,
    });
    if (p.isCancel(useMirror) || !useMirror) {
      p.log.warn("已取消。可手动设置后再试：");
      p.log.message("  " + pc.cyan(`npm config set registry ${NPM_MIRROR}`));
      return false;
    }
    registry = NPM_MIRROR;
  }

  if (await runInstall(manager, pkg, registry)) return true;

  if (registry === NPM_MIRROR) {
    p.log.error(`${displayName} 安装失败。`);
    return false;
  }

  p.log.warn("使用官方源安装失败。");
  const retry = await p.confirm({
    message: `切到 ${pc.cyan(NPM_MIRROR)} 镜像重试一次？`,
    initialValue: true,
  });
  if (p.isCancel(retry) || !retry) {
    p.log.message("如需手动切换镜像：");
    p.log.message("  " + pc.cyan(`npm config set registry ${NPM_MIRROR}`));
    return false;
  }

  if (await runInstall(manager, pkg, NPM_MIRROR)) return true;

  p.log.error(`${displayName} 安装失败（已用国内镜像重试）。`);
  return false;
}

export function installClaudeCode(manager: "npm" | "bun"): Promise<boolean> {
  return installNpmPackage(manager, CLAUDE_PACKAGE, "Claude Code");
}

export function installCodex(manager: "npm" | "bun"): Promise<boolean> {
  return installNpmPackage(manager, CODEX_PACKAGE, "Codex");
}
