#!/usr/bin/env bash
# GeekAPI CLI 一键安装脚本（macOS / Linux）
#
# 使用：
#   curl -fsSL https://raw.githubusercontent.com/CoderKuo/geekapi-cli/main/install.sh | bash
#
# 环境变量（可选）：
#   GEEKAPI_VERSION   指定版本，例如 v0.2.0；默认拉 latest
#   GEEKAPI_INSTALL_DIR  安装目录，默认 ~/.local/bin
#   GEEKAPI_BIN_NAME  生成的命令名，默认 geekapi

set -euo pipefail

REPO="CoderKuo/geekapi-cli"
INSTALL_DIR="${GEEKAPI_INSTALL_DIR:-$HOME/.local/bin}"
BIN_NAME="${GEEKAPI_BIN_NAME:-geekapi}"
VERSION="${GEEKAPI_VERSION:-}"

# 颜色输出（不支持时降级为空字符串）
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && tput setaf 1 >/dev/null 2>&1; then
  C_RED=$(tput setaf 1); C_GREEN=$(tput setaf 2); C_YELLOW=$(tput setaf 3)
  C_CYAN=$(tput setaf 6); C_BOLD=$(tput bold); C_RESET=$(tput sgr0)
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_CYAN=""; C_BOLD=""; C_RESET=""
fi

say()  { echo "${C_CYAN}==>${C_RESET} $*"; }
ok()   { echo "${C_GREEN}✓${C_RESET}  $*"; }
warn() { echo "${C_YELLOW}!${C_RESET}  $*" >&2; }
die()  { echo "${C_RED}✗${C_RESET}  $*" >&2; exit 1; }

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    darwin) os="mac" ;;
    linux)  os="linux" ;;
    *) die "不支持的操作系统：$os（仅支持 macOS / Linux，Windows 请用 install.ps1）" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm" ;;
    *) die "不支持的 CPU 架构：$arch" ;;
  esac

  if [ "$os" = "linux" ] && [ "$arch" = "arm" ]; then
    die "暂未提供 Linux ARM 二进制。可在 GitHub 提 issue。"
  fi

  if [ "$os" = "mac" ] && [ "$arch" = "arm" ]; then
    echo "geekapi-mac-arm"
  elif [ "$os" = "mac" ]; then
    echo "geekapi-mac"
  else
    echo "geekapi-linux"
  fi
}

resolve_url() {
  local asset="$1"
  if [ -n "$VERSION" ]; then
    echo "https://github.com/${REPO}/releases/download/${VERSION}/${asset}"
  else
    echo "https://github.com/${REPO}/releases/latest/download/${asset}"
  fi
}

main() {
  echo
  echo "${C_BOLD}GeekAPI CLI 安装器${C_RESET}"
  echo

  local asset url tmp target shell_rc
  asset="$(detect_platform)"
  url="$(resolve_url "$asset")"

  say "下载 $asset"
  echo "    来源：$url"

  tmp="$(mktemp -t geekapi.XXXXXX)"
  trap 'rm -f "$tmp"' EXIT

  if command -v curl >/dev/null 2>&1; then
    curl -fL --progress-bar -o "$tmp" "$url" || die "下载失败。检查网络或代理。"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "$tmp" "$url" || die "下载失败。检查网络或代理。"
  else
    die "需要 curl 或 wget，未找到任何一个。"
  fi

  [ -s "$tmp" ] || die "下载到的文件是空的。"

  mkdir -p "$INSTALL_DIR"
  target="$INSTALL_DIR/$BIN_NAME"
  mv "$tmp" "$target"
  chmod +x "$target"
  trap - EXIT
  ok "已安装到 $target"

  # 检查 PATH 并给针对性提示
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) PATH_OK=1 ;;
    *) PATH_OK=0 ;;
  esac

  if [ "$PATH_OK" = "1" ]; then
    echo
    ok "${C_BOLD}安装完成。运行 ${C_CYAN}${BIN_NAME}${C_RESET}${C_BOLD} 开始配置。${C_RESET}"
  else
    case "${SHELL:-}" in
      */zsh)  shell_rc="~/.zshrc" ;;
      */bash) shell_rc="~/.bashrc" ;;
      */fish) shell_rc="~/.config/fish/config.fish" ;;
      *)      shell_rc="你的 shell 配置文件" ;;
    esac
    echo
    warn "$INSTALL_DIR 不在 PATH 中。"
    echo "    请把下面这行加到 $shell_rc："
    echo "      ${C_CYAN}export PATH=\"$INSTALL_DIR:\$PATH\"${C_RESET}"
    echo "    或现在直接运行："
    echo "      ${C_CYAN}$target${C_RESET}"
  fi
  echo
}

main "$@"
