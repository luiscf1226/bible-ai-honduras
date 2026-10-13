import { CONTRACT_VERSION, type AdminError, type Manifest, type MetricRow, type UsersPage } from "./contract";

/**
 * Endpoint `/admin/*` del contrato v1 (lcf-admin#1), sin Convex adentro: la app
 * lo monta en su `http.ts` y le pasa cómo leer. Solo transporta agregados.
 *
 *   GET /admin/manifest
 *   GET /admin/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD&keys=a,b
 *   GET /admin/errors?limit=50
 *   GET /admin/users?q=texto&cursor=…&limit=50   (si la app declara "users")
 *
 * Auth: `Authorization: Bearer <ADMIN_API_TOKEN>`, un token por app.
 */
export type AdminHttpDeps = {
  token: string | undefined;
  manifest: Manifest;
  readMetrics: (query: { from: string; to: string; keys: string[] }) => Promise<MetricRow[]>;
  readErrors: (limit: number) => Promise<AdminError[]>;
  readUsers?: (query: { q: string; cursor?: string; limit: number }) => Promise<UsersPage>;
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const MAX_KEYS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Compara sin cortar en el primer carácter distinto. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function dayMs(day: string): number {
  return DAY_KEY.test(day) ? Date.parse(`${day}T00:00:00Z`) : Number.NaN;
}

export async function handleAdminRequest(request: Request, deps: AdminHttpDeps): Promise<Response> {
  if (!deps.token) {
    return json({ error: "ADMIN_API_TOKEN no está configurado" }, 503);
  }
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!safeEqual(given, deps.token)) {
    return json({ error: "No autorizado" }, 401);
  }

  const url = new URL(request.url);
  const route = url.pathname.replace(/\/+$/, "").split("/").pop();

  if (route === "manifest") {
    return json(deps.manifest);
  }

  if (route === "metrics") {
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const start = dayMs(from);
    const end = dayMs(to);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      return json({ error: "from y to tienen que ser YYYY-MM-DD, con from <= to" }, 400);
    }
    if ((end - start) / DAY_MS + 1 > MAX_RANGE_DAYS) {
      return json({ error: `El rango no puede pasar de ${MAX_RANGE_DAYS} días` }, 400);
    }
    const keys = (url.searchParams.get("keys") ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    if (keys.length > MAX_KEYS) {
      return json({ error: `Máximo ${MAX_KEYS} métricas por pedido` }, 400);
    }
    return json({ contractVersion: CONTRACT_VERSION, rows: await deps.readMetrics({ from, to, keys }) });
  }

  if (route === "errors") {
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(1, Math.floor(limit)), 200) : 50;
    return json({ contractVersion: CONTRACT_VERSION, errors: await deps.readErrors(safeLimit) });
  }

  if (route === "users" && deps.readUsers) {
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(1, Math.floor(limit)), 100) : 50;
    return json({ contractVersion: CONTRACT_VERSION, ...(await deps.readUsers({ q, cursor, limit: safeLimit })) });
  }

  return json({ error: "No existe" }, 404);
}
