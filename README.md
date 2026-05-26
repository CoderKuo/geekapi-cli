# GeekAPI · Claude Code & Codex 快捷工具

一个面向 [GeekAPI](https://www.geek2api.com) 中转站用户的零门槛工具：检测、下载、配置 Claude Code 和 Codex 一条龙。

## 功能

- 自动检测 Claude Code、Codex、Node.js、npm、Bun
- 缺什么装什么（npm/winget/brew 兜底，自动切 npmmirror 镜像）
- 一键写入 `~/.claude/settings.json` 和 `~/.codex/config.toml` + `auth.json`
- 配完自动健康检查（401 / 404 / 网络错误分别给针对性提示）
- 余额查询、打开控制台、多份滚动备份、原子写入

## 一键安装

### 已经装了 Node.js / npm（最快）

```bash
npm install -g geekapi-cli
geekapi
```

体积只有几十 KB，秒装。

### 没有 Node 也能装（独立二进制）

**macOS / Linux**：

```bash
curl -fsSL https://raw.githubusercontent.com/CoderKuo/geekapi-cli/main/install.sh | bash
```

**Windows（PowerShell）**：

```powershell
irm https://raw.githubusercontent.com/CoderKuo/geekapi-cli/main/install.ps1 | iex
```

装到 `~/.local/bin/geekapi`（Unix）或 `%LOCALAPPDATA%\Programs\GeekAPI\geekapi.exe`（Windows），然后在新终端运行 `geekapi` 即可。

环境变量可定制：

| 变量 | 作用 | 默认 |
| --- | --- | --- |
| `GEEKAPI_VERSION` | 锁定版本，例如 `v0.2.0` | latest |
| `GEEKAPI_INSTALL_DIR` | 安装目录 | `~/.local/bin` / `%LOCALAPPDATA%\Programs\GeekAPI` |
| `GEEKAPI_BIN_NAME` | 命令名 | `geekapi` / `geekapi.exe` |

## 直接下载

不想跑脚本可以从 [Releases](https://github.com/CoderKuo/geekapi-cli/releases/latest) 拿对应平台二进制：

| 系统 | 文件 |
| --- | --- |
| Windows 10/11 x64 | `geekapi-win.exe` |
| macOS（Intel） | `geekapi-mac` |
| macOS（Apple Silicon） | `geekapi-mac-arm` |
| Linux x64 | `geekapi-linux` |

Unix 下载后需要 `chmod +x`。

## 开发

```bash
bun install
bun run dev          # 本地运行
bun run build:npm    # 打 npm 发布的 ESM bundle 到 dist-npm/
bun run build:all    # 同时打包 win/mac/mac-arm/linux 独立二进制到 dist/
```

## 三种分发方式

| 方式 | 适合用户 | 包大小 |
| --- | --- | --- |
| `npm i -g geekapi-cli` | 已有 Node 18+ 环境 | 24kB |
| `curl/iwr` 安装脚本 | 完全没装 Node | 60-115MB（含 Bun runtime） |
| GitHub Releases 直接下载 | 想自己控制版本 | 同上 |

## 项目结构

```
src/
├── index.ts        # 主流程 + 菜单
├── detect.ts       # 环境检测
├── installer.ts    # Node/Bun/Claude/Codex 安装
├── config.ts       # ~/.claude/settings.json 读写
├── codex.ts        # ~/.codex/config.toml + auth.json 读写
├── health.ts       # /v1/models 验证 + /v1/usage 查余额
└── utils.ts        # 跨平台 spawn / atomicWrite / rotateBackup / openUrl
```

## 配置写入位置

- Claude Code：`~/.claude/settings.json` 的 `env.ANTHROPIC_BASE_URL` 和 `env.ANTHROPIC_AUTH_TOKEN`
- Codex：`~/.codex/config.toml`（model_providers.OpenAI base_url）+ `~/.codex/auth.json`（OPENAI_API_KEY）

写入前会备份成 `<file>.bak.<timestamp>`，最多保留 5 份。

用 `ANTHROPIC_AUTH_TOKEN` 而不是 `ANTHROPIC_API_KEY`，因为前者是 Claude Code 给第三方中转站设计的字段，不会触发对官方 Anthropic 鉴权的额外校验。

## 文档

- [使用教程（含截图）](./docs/使用教程.md)

## License

MIT
