# GeekAPI · Claude Code 快捷工具

一个面向 API 中转站终端用户的零门槛工具：打开就能检测/下载/配置 Claude Code。

## 功能

- 自动检测 Claude Code、Node.js、npm、Bun
- 没有 Claude Code → 引导安装运行时（Node 优先，Bun 备选）→ 用 npm/bun 全局装 `@anthropic-ai/claude-code`
- 已有 Claude Code → 直接进 API 配置，写入 `~/.claude/settings.json` 的 `env.ANTHROPIC_BASE_URL` 和 `env.ANTHROPIC_AUTH_TOKEN`
- 写入前自动备份原配置到 `settings.json.bak`，保留其它字段不动
- 一键启动 Claude Code

## 使用

直接运行打包好的 exe（无需安装 Bun）：

```bash
# Windows
./dist/geekapi-win.exe

# macOS
./dist/geekapi-mac          # Intel
./dist/geekapi-mac-arm      # Apple Silicon

# Linux
./dist/geekapi-linux
```

## 开发

```bash
bun install
bun run dev          # 本地运行
bun run build:all    # 同时打包 win/mac/mac-arm/linux
```

## 自定义中转站默认地址

编辑 `src/index.ts` 顶部：

```ts
const DEFAULT_BASE_URL = "https://api.geekapi.com"; // 改成你的域名
const BRAND = "GeekAPI";                            // 改成你的品牌名
```

然后 `bun run build:all` 重新打包分发。

## 项目结构

```
src/
├── index.ts        # 主流程 + 菜单
├── detect.ts       # 环境检测
├── installer.ts    # Node/Bun/Claude Code 安装
├── config.ts       # settings.json 读写
└── utils.ts        # 跨平台 spawn / commandExists
```

## 配置写入位置

`~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-relay.example.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxx"
  }
}
```

用 `ANTHROPIC_AUTH_TOKEN` 而不是 `ANTHROPIC_API_KEY`，因为前者是 Claude Code 给第三方中转站设计的字段，不会触发对官方 Anthropic 鉴权的额外校验。

## 注意

- Windows 自动安装 Node.js 用 winget；首次运行会弹 UAC，需要管理员授权。
- 安装完运行时后请关闭并重开本工具，让 PATH 生效。
- npm 国内访问慢时，工具失败后会提示切换镜像：`npm config set registry https://registry.npmmirror.com`
