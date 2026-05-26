/**
 * GeekAPI 健康检查与余额查询。
 *
 * verifyKey：调 /v1/models，401 → key 错；404 → 路径不对；网络错误 → 中转站不可达。
 * fetchUsage：调 /v1/usage，按你给的 extractor 兼容多种返回字段。
 */

export type VerifyResultKind = "ok" | "auth" | "notfound" | "network" | "other";

export interface VerifyResult {
  kind: VerifyResultKind;
  status?: number;
  message: string;
  hint?: string;
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + path;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyKey(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 8000,
): Promise<VerifyResult> {
  const url = joinUrl(baseUrl, "/v1/models");
  try {
    const r = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      timeoutMs,
    );
    if (r.ok) return { kind: "ok", status: r.status, message: "key 有效" };

    if (r.status === 401 || r.status === 403) {
      return {
        kind: "auth",
        status: r.status,
        message: `鉴权失败（HTTP ${r.status}）`,
        hint: "API Key 不正确，或当前分组不支持 Claude Code。请到 GeekAPI 控制台核对密钥与分组。",
      };
    }
    if (r.status === 404) {
      return {
        kind: "notfound",
        status: r.status,
        message: "404 路径不存在",
        hint: "Base URL 或路由不对。检查中转站地址是否填错。",
      };
    }
    let body = "";
    try {
      body = (await r.text()).slice(0, 200);
    } catch {
      // ignore
    }
    return {
      kind: "other",
      status: r.status,
      message: `HTTP ${r.status}${body ? `：${body}` : ""}`,
    };
  } catch (err) {
    return {
      kind: "network",
      message: `网络错误：${err instanceof Error ? err.message : String(err)}`,
      hint: "中转站连不上。检查网络、代理或 base URL。",
    };
  }
}

export interface UsageInfo {
  isValid: boolean;
  remaining?: number | string;
  unit?: string;
  raw: unknown;
}

export interface UsageResult {
  ok: boolean;
  status?: number;
  data?: UsageInfo;
  error?: string;
}

export async function fetchUsage(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 8000,
): Promise<UsageResult> {
  const url = joinUrl(baseUrl, "/v1/usage");
  try {
    const r = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      timeoutMs,
    );
    if (!r.ok) {
      let body = "";
      try {
        body = (await r.text()).slice(0, 200);
      } catch {
        // ignore
      }
      return {
        ok: false,
        status: r.status,
        error: `HTTP ${r.status}${body ? `：${body}` : ""}`,
      };
    }

    let json: any;
    try {
      json = await r.json();
    } catch (e) {
      return { ok: false, status: r.status, error: "返回不是合法 JSON" };
    }

    const remaining =
      json?.remaining ?? json?.quota?.remaining ?? json?.balance ?? undefined;
    const unit = json?.unit ?? json?.quota?.unit ?? "USD";
    const isValid = json?.is_active ?? json?.isValid ?? true;

    return {
      ok: true,
      status: r.status,
      data: { isValid, remaining, unit, raw: json },
    };
  } catch (err) {
    return {
      ok: false,
      error: `网络错误：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
