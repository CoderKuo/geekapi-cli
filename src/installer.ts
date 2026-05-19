import * as p from "@clack/prompts";
import pc from "picocolors";
import { IS_WIN, IS_MAC, IS_LINUX, run, runStreaming, commandExists } from "./utils";

const NODE_DOWNLOAD_URL = "https://nodejs.org/en/download";
const BUN_DOWNLOAD_URL = "https://bun.sh";
const CLAUDE_PACKAGE = "@anthropic-ai/claude-code";

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

export async function installClaudeCode(manager: "npm" | "bun"): Promise<boolean> {
  p.log.info(
    `即将运行：${pc.cyan(
      manager === "npm" ? `npm install -g ${CLAUDE_PACKAGE}` : `bun add -g ${CLAUDE_PACKAGE}`,
    )}`,
  );
  const cmd =
    manager === "npm" ? ["npm", "install", "-g", CLAUDE_PACKAGE] : ["bun", "add", "-g", CLAUDE_PACKAGE];
  const ok = await runStreaming(cmd);
  if (!ok) {
    p.log.error("Claude Code 安装失败。可尝试设置 npm 镜像后重试：");
    p.log.message("  " + pc.cyan("npm config set registry https://registry.npmmirror.com"));
    return false;
  }
  return true;
}
