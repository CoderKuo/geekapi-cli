import * as p from "@clack/prompts";
import pc from "picocolors";
import { detectEnvironment, type Environment } from "./detect";
import { ensureNodeOrBun, installClaudeCode, installCodex } from "./installer";
import { applyApiConfig, readSettings, maskToken, SETTINGS_PATH } from "./config";
import {
  applyCodexConfig,
  readCodexAuth,
  readCodexConfigToml,
  extractBaseUrl,
  CODEX_CONFIG_PATH,
  CODEX_AUTH_PATH,
} from "./codex";
import { runStreaming } from "./utils";

const DEFAULT_BASE_URL = "https://www.geek2api.com";
const DEFAULT_CODEX_BASE_URL = "https://www.geek2api.com";
const BRAND = "GeekAPI";

function banner() {
  const line = pc.gray("─".repeat(60));
  console.log("");
  console.log(line);
  console.log(`  ${pc.bold(pc.cyan(BRAND))} ${pc.gray("·")} Claude Code & Codex 快捷配置工具`);
  console.log(line);
  console.log("");
}

function fmt(label: string, status: { installed: boolean; version?: string }): string {
  if (!status.installed) return `${pc.red("✗")} ${label.padEnd(14)} ${pc.gray("未安装")}`;
  return `${pc.green("✓")} ${label.padEnd(14)} ${pc.gray(status.version ?? "已安装")}`;
}

function printEnv(env: Environment) {
  console.log(pc.bold("环境检测"));
  console.log("  " + fmt("Claude Code", env.claude));
  console.log("  " + fmt("Codex", env.codex));
  console.log("  " + fmt("Node.js", env.node));
  console.log("  " + fmt("npm", env.npm));
  console.log("  " + fmt("Bun", env.bun));
  console.log("");
}

async function ensureClaudeInstalled(env: Environment): Promise<boolean> {
  if (env.claude.installed) return true;

  p.log.warn("Claude Code 未安装，开始引导安装。");
  const runtime = await ensureNodeOrBun();
  if (!runtime.ok) {
    p.log.error("运行时安装未完成，请重新打开本工具。");
    return false;
  }

  const ok = await installClaudeCode(runtime.manager);
  if (!ok) return false;

  p.log.success("Claude Code 安装完成。");
  return true;
}

async function ensureCodexInstalled(env: Environment): Promise<boolean> {
  if (env.codex.installed) return true;

  const wantInstall = await p.confirm({
    message: `Codex 还没装，现在通过 npm 安装 ${pc.cyan("@openai/codex")} 吗？`,
    initialValue: true,
  });
  if (p.isCancel(wantInstall) || !wantInstall) return false;

  const runtime = await ensureNodeOrBun();
  if (!runtime.ok) {
    p.log.error("运行时安装未完成，请重新打开本工具。");
    return false;
  }

  const ok = await installCodex(runtime.manager);
  if (!ok) return false;

  p.log.success("Codex 安装完成。");
  env.codex = (await detectEnvironment()).codex;
  return true;
}

async function configureClaude(): Promise<void> {
  const current = await readSettings();
  const currentBase = (current.env?.ANTHROPIC_BASE_URL as string) ?? "";
  const currentToken = (current.env?.ANTHROPIC_AUTH_TOKEN as string) ?? "";

  if (currentBase || currentToken) {
    p.log.info(
      `当前 Claude 配置：${pc.gray("base=")} ${currentBase || pc.gray("(空)")}  ${pc.gray(
        "token=",
      )} ${currentToken ? maskToken(currentToken) : pc.gray("(空)")}`,
    );
  }

  const useDefault = await p.confirm({
    message: `是否使用 ${pc.cyan(DEFAULT_BASE_URL)} ？`,
    initialValue: true,
  });
  if (p.isCancel(useDefault)) {
    p.cancel("已取消");
    return;
  }

  let baseUrl: string;
  if (useDefault) {
    baseUrl = DEFAULT_BASE_URL;
  } else {
    const input = await p.text({
      message: "请输入 API Base URL",
      placeholder: "https://your-relay.example.com",
      initialValue: currentBase && currentBase !== DEFAULT_BASE_URL ? currentBase : "",
      validate(v) {
        if (!v) return "不能为空";
        if (!/^https?:\/\//i.test(v)) return "必须以 http:// 或 https:// 开头";
      },
    });
    if (p.isCancel(input)) {
      p.cancel("已取消");
      return;
    }
    baseUrl = input.trim();
  }

  const authToken = await p.password({
    message: "请输入 Claude API Key",
    validate(v) {
      if (!v) return "不能为空";
      if (v.length < 8) return "长度看起来不太对";
    },
  });
  if (p.isCancel(authToken)) {
    p.cancel("已取消");
    return;
  }

  const result = await applyApiConfig({ baseUrl, authToken: authToken.trim() });
  p.log.success(`已写入 ${pc.cyan(SETTINGS_PATH)}`);
  p.log.message(`${pc.gray("base =")} ${pc.cyan(baseUrl)}`);
  if (result.backup) p.log.message(pc.gray(`原配置已备份到 ${result.backup}`));
}

async function configureCodexFlow(): Promise<void> {
  const currentToml = await readCodexConfigToml();
  const currentAuth = await readCodexAuth();
  const currentBase = currentToml ? extractBaseUrl(currentToml) : null;
  const currentKey = currentAuth?.OPENAI_API_KEY ?? "";

  if (currentBase || currentKey) {
    p.log.info(
      `当前 Codex 配置：${pc.gray("base=")} ${currentBase ?? pc.gray("(空)")}  ${pc.gray(
        "key=",
      )} ${currentKey ? maskToken(currentKey) : pc.gray("(空)")}`,
    );
  }

  const useDefault = await p.confirm({
    message: `是否使用 ${pc.cyan(DEFAULT_CODEX_BASE_URL)} ？`,
    initialValue: true,
  });
  if (p.isCancel(useDefault)) {
    p.cancel("已取消");
    return;
  }

  let baseUrl: string;
  if (useDefault) {
    baseUrl = DEFAULT_CODEX_BASE_URL;
  } else {
    const input = await p.text({
      message: "请输入 Codex Base URL",
      placeholder: "https://your-relay.example.com",
      initialValue: currentBase && currentBase !== DEFAULT_CODEX_BASE_URL ? currentBase : "",
      validate(v) {
        if (!v) return "不能为空";
        if (!/^https?:\/\//i.test(v)) return "必须以 http:// 或 https:// 开头";
      },
    });
    if (p.isCancel(input)) {
      p.cancel("已取消");
      return;
    }
    baseUrl = input.trim();
  }

  const apiKey = await p.password({
    message: "请输入 Codex API Key（与 Claude 的 key 不同）",
    validate(v) {
      if (!v) return "不能为空";
      if (v.length < 8) return "长度看起来不太对";
    },
  });
  if (p.isCancel(apiKey)) {
    p.cancel("已取消");
    return;
  }

  const result = await applyCodexConfig({ baseUrl, apiKey: apiKey.trim() });
  p.log.success(`已写入 ${pc.cyan(CODEX_CONFIG_PATH)}`);
  p.log.success(`已写入 ${pc.cyan(CODEX_AUTH_PATH)}`);
  p.log.message(`${pc.gray("base =")} ${pc.cyan(baseUrl)}`);
  if (result.configBackup) p.log.message(pc.gray(`config.toml 备份到 ${result.configBackup}`));
  if (result.authBackup) p.log.message(pc.gray(`auth.json 备份到 ${result.authBackup}`));
}

async function showCurrent() {
  console.log(pc.bold("Claude Code · ~/.claude/settings.json"));
  const settings = await readSettings();
  const env = settings.env ?? {};
  if (Object.keys(env).length === 0) {
    console.log(pc.gray("  (空)"));
  } else {
    for (const [k, v] of Object.entries(env)) {
      const display =
        k === "ANTHROPIC_AUTH_TOKEN" || k === "ANTHROPIC_API_KEY"
          ? maskToken(String(v))
          : String(v);
      console.log(`  ${pc.cyan(k)} = ${display}`);
    }
  }
  console.log("");

  console.log(pc.bold("Codex · ~/.codex/config.toml + auth.json"));
  const toml = await readCodexConfigToml();
  const auth = await readCodexAuth();
  if (!toml && !auth) {
    console.log(pc.gray("  (未配置)"));
  } else {
    const base = toml ? extractBaseUrl(toml) : null;
    console.log(`  ${pc.cyan("base_url")} = ${base ?? pc.gray("(未读到)")}`);
    console.log(
      `  ${pc.cyan("OPENAI_API_KEY")} = ${
        auth?.OPENAI_API_KEY ? maskToken(String(auth.OPENAI_API_KEY)) : pc.gray("(空)")
      }`,
    );
  }
  console.log("");
}

async function mainMenu(env: Environment) {
  while (true) {
    const action = await p.select({
      message: "选择操作：",
      options: [
        { value: "claude_config", label: "配置 Claude Code（写入 ~/.claude/settings.json）" },
        { value: "codex_config", label: "配置 Codex（写入 ~/.codex/config.toml + auth.json）" },
        { value: "show", label: "查看当前配置" },
        { value: "claude_install", label: "安装 / 升级 Claude Code" },
        { value: "codex_install", label: "安装 / 升级 Codex" },
        { value: "launch_claude", label: "启动 Claude Code" },
        { value: "launch_codex", label: "启动 Codex" },
        { value: "quit", label: "退出" },
      ],
    });

    if (p.isCancel(action) || action === "quit") {
      p.outro(pc.gray("再见。"));
      return;
    }

    if (action === "claude_config") {
      await configureClaude();
    } else if (action === "codex_config") {
      await ensureCodexInstalled(env);
      await configureCodexFlow();
    } else if (action === "show") {
      await showCurrent();
    } else if (action === "claude_install") {
      const runtime = await ensureNodeOrBun();
      if (runtime.ok) await installClaudeCode(runtime.manager);
      env.claude = (await detectEnvironment()).claude;
    } else if (action === "codex_install") {
      const runtime = await ensureNodeOrBun();
      if (runtime.ok) await installCodex(runtime.manager);
      env.codex = (await detectEnvironment()).codex;
    } else if (action === "launch_claude") {
      p.log.info("即将启动 Claude Code...");
      await runStreaming(["claude"]);
      return;
    } else if (action === "launch_codex") {
      p.log.info("即将启动 Codex...");
      await runStreaming(["codex"]);
      return;
    }
  }
}

async function main() {
  banner();
  p.intro(pc.bgCyan(pc.black(` ${BRAND} CLI `)));

  const s = p.spinner();
  s.start("检测环境中");
  const env = await detectEnvironment();
  s.stop("环境检测完成");

  printEnv(env);

  const claudeReady = await ensureClaudeInstalled(env);
  if (!claudeReady) {
    p.outro(pc.yellow("Claude Code 环境未就绪，可手动完成后重新打开本工具。"));
    return;
  }

  if (!env.claude.installed) {
    const refreshed = await detectEnvironment();
    env.claude = refreshed.claude;
  }

  const target = await p.select({
    message: "现在要配置哪个？",
    options: [
      { value: "claude", label: "只配 Claude Code" },
      { value: "both", label: "Claude Code + Codex 都配" },
      { value: "codex", label: "只配 Codex" },
      { value: "skip", label: "都先跳过，进主菜单" },
    ],
    initialValue: "claude",
  });

  if (!p.isCancel(target)) {
    if (target === "claude" || target === "both") {
      await configureClaude();
    }
    if (target === "codex" || target === "both") {
      const ready = await ensureCodexInstalled(env);
      if (ready) await configureCodexFlow();
    }
  }

  await mainMenu(env);
}

main().catch((err) => {
  console.error(pc.red("\n出错了："), err);
  process.exit(1);
});
