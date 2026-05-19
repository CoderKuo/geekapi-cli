import * as p from "@clack/prompts";
import pc from "picocolors";
import { detectEnvironment, type Environment } from "./detect";
import { ensureNodeOrBun, installClaudeCode } from "./installer";
import { applyApiConfig, readSettings, maskToken, SETTINGS_PATH } from "./config";
import { runStreaming, IS_WIN } from "./utils";

const DEFAULT_BASE_URL = "https://www.geek2api.com";
const BRAND = "GeekAPI";

function banner() {
  const line = pc.gray("─".repeat(54));
  console.log("");
  console.log(line);
  console.log(`  ${pc.bold(pc.cyan(BRAND))} ${pc.gray("·")} Claude Code 快捷配置工具`);
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

  const s = p.spinner();
  s.start(`正在安装 ${pc.cyan("@anthropic-ai/claude-code")}（首次较慢）`);
  s.stop();
  const ok = await installClaudeCode(runtime.manager);
  if (!ok) return false;

  p.log.success("Claude Code 安装完成。");
  return true;
}

async function configureApi(): Promise<void> {
  const current = await readSettings();
  const currentBase = (current.env?.ANTHROPIC_BASE_URL as string) ?? "";
  const currentToken = (current.env?.ANTHROPIC_AUTH_TOKEN as string) ?? "";

  if (currentBase || currentToken) {
    p.log.info(
      `当前配置：${pc.gray("base=")} ${currentBase || pc.gray("(空)")}  ${pc.gray(
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
    message: "请输入 API Key",
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

async function showCurrent() {
  const settings = await readSettings();
  const env = settings.env ?? {};
  console.log(pc.bold("当前 settings.json env 段："));
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
}

async function launchClaude(): Promise<void> {
  p.log.info("即将启动 Claude Code...");
  await runStreaming(IS_WIN ? ["claude"] : ["claude"]);
}

async function mainMenu(env: Environment) {
  while (true) {
    const action = await p.select({
      message: "选择操作：",
      options: [
        { value: "config", label: "配置 / 修改 API（写入 settings.json）" },
        { value: "show", label: "查看当前配置" },
        { value: "reinstall", label: "重新安装 / 升级 Claude Code" },
        { value: "launch", label: "启动 Claude Code" },
        { value: "quit", label: "退出" },
      ],
    });

    if (p.isCancel(action) || action === "quit") {
      p.outro(pc.gray("再见。"));
      return;
    }

    if (action === "config") {
      await configureApi();
    } else if (action === "show") {
      await showCurrent();
    } else if (action === "reinstall") {
      const runtime = await ensureNodeOrBun();
      if (runtime.ok) await installClaudeCode(runtime.manager);
      env.claude = (await detectEnvironment()).claude;
    } else if (action === "launch") {
      await launchClaude();
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
    p.outro(pc.yellow("环境未就绪，请按提示完成后重新打开本工具。"));
    return;
  }

  if (!env.claude.installed) {
    const refreshed = await detectEnvironment();
    env.claude = refreshed.claude;
  }

  const doConfigNow = await p.confirm({
    message: "现在配置 API 中转站？",
    initialValue: true,
  });

  if (!p.isCancel(doConfigNow) && doConfigNow) {
    await configureApi();
  }

  await mainMenu(env);
}

main().catch((err) => {
  console.error(pc.red("\n出错了："), err);
  process.exit(1);
});
