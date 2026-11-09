#!/usr/bin/env node
// Avisa al fundador de los reportes nuevos del chat de amigos. Lo corre
// .github/workflows/reportes-chat.yml cada 6 horas: a Apple le prometimos
// revisar cada reporte en menos de 24 h (notas de revisión de la 1.0.3).
//
// "Nuevos" = creados entre el arranque de la última corrida exitosa de este
// workflow (o hace 24 h si nunca corrió) y el arranque de esta, así dos
// corridas no avisan el mismo reporte. Si hay, abre un issue con la
// etiqueta `reportes-chat` asignado al dueño del repo, o comenta en el que ya
// esté abierto: issue abierto = reportes sin revisar. Se cierra a mano.
//
// El repo es público: el issue lleva motivo y hora, nunca correo, ids ni
// evidencia. Esos se leen con `friends:recentReports` en Convex.
//
// Variables: CONVEX_DEPLOY_KEY (o CONVEX_DEPLOYMENT en local), GH_TOKEN,
// GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER. Opcional SINCE_HOURS para fijar
// la ventana. Con DRY_RUN=1 solo imprime el aviso.

import { execFileSync } from "node:child_process";

const LABEL = "reportes-chat";
const WORKFLOW = "reportes-chat.yml";
const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const REASONS = {
  ofensivo: "Insultos, odio o acoso",
  sexual: "Contenido sexual",
  estafa: "Ventas, préstamos o estafas",
  privado: "Datos privados de otra persona",
  peligro: "Alguien está en peligro",
};

const dryRun = process.env.DRY_RUN === "1";
const repo = process.env.GITHUB_REPOSITORY ?? "luiscf1226/bible-ai-honduras";
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? repo.split("/")[0];

function run(cmd, args, input) {
  return execFileSync(cmd, args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] });
}

function gh(...args) {
  return run("gh", args);
}

function sinceMs() {
  const hours = Number(process.env.SINCE_HOURS);
  if (hours > 0) return Date.now() - hours * 60 * 60 * 1000;
  const runs = JSON.parse(
    gh("api", `repos/${repo}/actions/workflows/${WORKFLOW}/runs?status=success&per_page=1`),
  ).workflow_runs;
  return runs?.length ? Date.parse(runs[0].run_started_at) : Date.now() - REVIEW_WINDOW_MS;
}

const hondurasTime = new Intl.DateTimeFormat("es-HN", {
  timeZone: "America/Tegucigalpa",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function message(reports) {
  const deadline = Math.min(...reports.map((r) => r.createdAt)) + REVIEW_WINDOW_MS;
  const rows = reports
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(
      (r) =>
        `| ${hondurasTime.format(r.createdAt)} | ${REASONS[r.reason] ?? r.reason} | ${
          r.countsForSuspension ? "Sí" : "No"
        } | ${r.reportedSuspended ? "Sí" : "No"} |`,
    );
  const urgent = reports.some((r) => r.reason === "peligro")
    ? "\n> **Hay un reporte de «Alguien está en peligro»: miralo primero.**\n"
    : "";
  return `## ${reports.length === 1 ? "1 reporte nuevo" : `${reports.length} reportes nuevos`} en el chat de amigos

Revisalos antes del **${hondurasTime.format(deadline)} (hora de Honduras)**: a Apple le prometimos menos de 24 h.
${urgent}
| Recibido | Motivo | Cuenta para la suspensión automática | Reportado ya suspendido |
|---|---|---|---|
${rows.join("\n")}

Correo, evidencia e ids no van acá porque el repo es público. Para verlos:

\`\`\`
CONVEX_DEPLOYMENT=dev:neighborly-kudu-508 npx convex run friends:recentReports
\`\`\`

o en el dashboard de Convex → Functions → \`friends:recentReports\`. Suspensión permanente: poné \`friendsSuspendedAt\` en el usuario. Cerrá este issue cuando termines.`;
}

function untilMs() {
  const runId = process.env.GITHUB_RUN_ID;
  return runId ? Date.parse(JSON.parse(gh("api", `repos/${repo}/actions/runs/${runId}`)).run_started_at) : Date.now();
}

const since = sinceMs();
const until = untilMs();
const reports = JSON.parse(run("npx", ["convex", "run", "friends:recentReports", '{"limit": 200}'])).filter(
  (r) => r.createdAt > since && r.createdAt <= until,
);
console.log(`${reports.length} reporte(s) desde ${new Date(since).toISOString()}`);
if (reports.length === 0) process.exit(0);

const body = message(reports);
if (dryRun) {
  console.log(body);
  process.exit(0);
}

gh("label", "create", LABEL, "--repo", repo, "--color", "d93f0b", "--description", "Reportes del chat sin revisar", "--force");
const open = JSON.parse(
  gh("issue", "list", "--repo", repo, "--label", LABEL, "--state", "open", "--json", "number", "--limit", "1"),
);
if (open.length) {
  run("gh", ["issue", "comment", String(open[0].number), "--repo", repo, "--body-file", "-"], `@${owner}\n\n${body}`);
  console.log(`Comentado en #${open[0].number}`);
} else {
  const url = run(
    "gh",
    ["issue", "create", "--repo", repo, "--title", "Reportes del chat sin revisar", "--label", LABEL, "--assignee", owner, "--body-file", "-"],
    body,
  );
  console.log(`Abierto ${url.trim()}`);
}
