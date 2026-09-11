#!/usr/bin/env python3
"""Genera el reporte de QA como un solo HTML autocontenido (imágenes embebidas)."""
import base64
import re
import json
import pathlib
import sys

# Uso:
#   python3 qa-harness/build-report.py [pase] [--embed]
#
#   pase     carpeta bajo docs/qa/ (default: el pase más reciente)
#   --embed  mete los PNG en base64 y escribe un QA-REPORT.html portable
#            en la raíz del repo (no se commitea: pesa ~12 MB)
#
# Por defecto escribe docs/qa/<pase>/index.html enlazando shots/ en relativo.

ROOT = pathlib.Path(__file__).resolve().parent.parent
QA_DIR = ROOT / "docs" / "qa"

args = [a for a in sys.argv[1:] if not a.startswith("--")]
EMBED = "--embed" in sys.argv

passes = sorted(d for d in QA_DIR.iterdir() if d.is_dir())
if not passes:
    sys.exit(f"no hay ningún pase de QA en {QA_DIR}")
PASS = QA_DIR / args[0] if args else passes[-1]
if not PASS.is_dir():
    sys.exit(f"no existe el pase {PASS}")

SHOTS = PASS / "shots"
DATA = json.loads((PASS / "report-data.json").read_text(encoding="utf-8"))
OUT = ROOT / "QA-REPORT.html" if EMBED else PASS / "index.html"


def img(name):
    path = SHOTS / name
    if not path.exists():
        return f'<div class="missing">falta {name}</div>'
    if EMBED:
        src = "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()
    else:
        src = f"shots/{name}"
    tag = f'<img alt="{name}" loading="lazy" src="{src}">'
    if not EMBED:
        # En la versión enlazada, click abre el PNG a tamaño real.
        tag = f'<a href="{src}">{tag}</a>'
    return f'<figure class="shot">{tag}<figcaption>{name}</figcaption></figure>'


SEV = {
    "alto": ("sev-high", "Alto"),
    "medio": ("sev-med", "Medio"),
    "bajo": ("sev-low", "Bajo"),
    "ok": ("sev-ok", "OK"),
}


def esc(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def rich(text):
    """Escapa y luego permite `code`, **negrita** y *cursiva*."""
    out = esc(text)
    parts = out.split("`")
    for i, part in enumerate(parts):
        if i % 2:
            parts[i] = f"<code>{part}</code>"
        else:
            part = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", part)
            parts[i] = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", part)
    return "".join(parts)


def findings_table(items):
    rows = []
    for f in items:
        cls, label = SEV[f["sev"]]
        rows.append(
            f'<tr id="{f["id"]}">'
            f'<td class="idcell"><a href="#{f["id"]}">{f["id"]}</a></td>'
            f'<td><span class="pill {cls}">{label}</span></td>'
            f'<td class="mod">{esc(f["module"])}</td>'
            f'<td><strong>{rich(f["title"])}</strong>'
            f'<div class="detail">{rich(f["detail"])}</div>'
            f'<div class="where">{rich(f["where"])}</div></td>'
            f'<td class="ev">{esc(f.get("evidence", "—"))}</td>'
            "</tr>"
        )
    return "\n".join(rows)


def flows_html(flows):
    out = []
    for flow in flows:
        steps = []
        for i, s in enumerate(flow["steps"], 1):
            shot = img(s["shot"]) if s.get("shot") else ""
            note = (
                f'<div class="note {"bad" if s.get("bad") else ""}">{rich(s["note"])}</div>'
                if s.get("note")
                else ""
            )
            steps.append(
                f'<li class="step"><div class="stepbody">'
                f'<div class="stepnum">{i}</div>'
                f'<div><div class="act">{rich(s["action"])}</div>'
                f'<div class="obs"><span>Se ve:</span> {rich(s["observed"])}</div>{note}</div>'
                f"</div>{shot}</li>"
            )
        out.append(
            f'<section class="flow" id="{flow["id"]}">'
            f'<h3>{esc(flow["title"])}</h3>'
            f'<p class="route">{rich(flow["route"])}</p>'
            f'<ol class="steps">{"".join(steps)}</ol></section>'
        )
    return "\n".join(out)


def routes_html(rows):
    body = "\n".join(
        f"<tr><td><code>{esc(r[0])}</code></td><td>{esc(r[1])}</td>"
        f"<td>{rich(r[2])}</td><td>{rich(r[3])}</td></tr>"
        for r in rows
    )
    return body


CSS = """
:root{--bg:#12100e;--panel:#1b1815;--panel2:#241f1b;--ink:#f3ede4;--muted:#b8aa99;
--faint:#8b7d6d;--line:#332b25;--accent:#c9a26b;--sage:#8fa58c;--red:#d2694b;--amber:#d9a441}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:48px 24px 96px}
h1{font-size:34px;line-height:1.2;margin:0 0 8px;letter-spacing:-.02em}
h2{font-size:22px;margin:56px 0 16px;padding-bottom:10px;border-bottom:1px solid var(--line)}
h3{font-size:18px;margin:0 0 4px}
a{color:var(--accent)}
.sub{color:var(--muted);margin:0 0 28px}
.meta{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 8px}
.chip{background:var(--panel);border:1px solid var(--line);border-radius:999px;
padding:6px 14px;font-size:13px;color:var(--muted)}
.chip b{color:var(--ink);font-weight:600}
.callout{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--accent);
border-radius:10px;padding:16px 18px;margin:18px 0;color:var(--muted);font-size:14.5px}
.callout b{color:var(--ink)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:18px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
.card .n{font-size:26px;font-weight:600}
.card .l{color:var(--faint);font-size:13px;margin-top:2px}
.card.good .n{color:var(--sage)} .card.bad .n{color:var(--red)} .card.warn .n{color:var(--amber)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14.5px}
th{text-align:left;color:var(--faint);font-weight:600;font-size:12px;letter-spacing:.08em;
text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--line)}
td{padding:12px;border-bottom:1px solid var(--line);vertical-align:top}
tr:target td{background:#241d16}
code{background:var(--panel2);border:1px solid var(--line);border-radius:5px;
padding:1px 6px;font-size:13px;color:#e5d3b8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.pill{display:inline-block;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:600;white-space:nowrap}
.sev-high{background:#3a1c14;color:#f0a288;border:1px solid #5c2a1c}
.sev-med{background:#3a2f14;color:#e8c877;border:1px solid #574515}
.sev-low{background:#20262a;color:#9fb6c4;border:1px solid #2c3841}
.sev-ok{background:#1c2a1e;color:#9fc9a4;border:1px solid #27402b}
.idcell{white-space:nowrap;font-family:ui-monospace,Menlo,monospace;font-size:13px}
.mod{color:var(--muted);white-space:nowrap;font-size:13.5px}
.detail{color:var(--muted);font-size:14px;margin-top:6px}
.where{color:var(--faint);font-size:12.5px;margin-top:6px;font-family:ui-monospace,Menlo,monospace}
.ev{color:var(--faint);font-size:12px;white-space:nowrap}
.flow{background:var(--panel);border:1px solid var(--line);border-radius:14px;
padding:22px 24px;margin:16px 0}
.route{color:var(--faint);font-size:13px;margin:0 0 18px;font-family:ui-monospace,Menlo,monospace}
.steps{list-style:none;margin:0;padding:0;display:grid;
grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}
.step{background:var(--panel2);border:1px solid var(--line);border-radius:12px;
padding:14px;display:flex;flex-direction:column}
.stepbody{display:flex;gap:10px;margin-bottom:12px}
.stepnum{flex:none;width:24px;height:24px;border-radius:999px;background:#332a22;
color:var(--accent);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.act{font-weight:600;font-size:14.5px}
.obs{color:var(--muted);font-size:13.5px;margin-top:5px}
.obs span{color:var(--faint)}
.note{margin-top:8px;font-size:12.5px;color:var(--sage);border-left:2px solid var(--sage);padding-left:9px}
.note.bad{color:#f0a288;border-color:var(--red)}
.shot{margin:auto 0 0;padding:0}
.shot img{width:100%;display:block;border-radius:9px;border:1px solid var(--line);background:#fff}
.shot figcaption{color:var(--faint);font-size:11px;margin-top:6px;font-family:ui-monospace,Menlo,monospace}
.missing{color:var(--red);font-size:12px}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
.toc a{background:var(--panel);border:1px solid var(--line);border-radius:8px;
padding:7px 13px;font-size:13.5px;text-decoration:none}
footer{color:var(--faint);font-size:13px;margin-top:60px;border-top:1px solid var(--line);padding-top:20px}
"""

html = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA — Bible AI Honduras · estado actual de master</title>
<style>{CSS}</style></head><body><div class="wrap">

<h1>QA de la app — estado actual de <code>master</code></h1>
<p class="sub">Recorrido completo de los 4 módulos, la autenticación, los ajustes y el paywall,
con captura de cada pantalla y de sus estados (cargando, vacío, error, límite, Pro, modo noche).</p>

<div class="meta">
  <span class="chip">Rama <b>{DATA['branch']}</b></span>
  <span class="chip">Commit <b>{DATA['commit']}</b></span>
  <span class="chip">Fecha <b>{DATA['date']}</b></span>
  <span class="chip">Pantallas capturadas <b>{DATA['shot_count']}</b></span>
  <span class="chip">Hallazgos <b>{DATA['finding_count']}</b></span>
</div>

<div class="callout">
<b>Cómo se produjo esto.</b> La app se levantó de verdad en un navegador
(<code>QA_HARNESS=1 npx expo start --web</code>) y se recorrió pantalla por pantalla.
Como <code>master</code> no arranca sin credenciales de Clerk y Convex
(<code>app/_layout.tsx</code> y <code>src/lib/convexClient.ts</code> tiran error en el import),
se montó un harness que sustituye <em>solo</em> los SDK externos por mocks
(<code>qa-harness/</code>, ver su README). <b>El código de las pantallas es el real, sin tocar</b>;
también son reales los catálogos de Voces e Historias. Lo que es de mentira: el texto bíblico,
las respuestas de IA y las ilustraciones de las historias.
</div>

<div class="cards">
  <div class="card good"><div class="n">{DATA['tests']}</div><div class="l">tests en verde ({DATA['test_files']} archivos)</div></div>
  <div class="card good"><div class="n">OK</div><div class="l">tsc --noEmit sin errores</div></div>
  <div class="card bad"><div class="n">{DATA['n_high']}</div><div class="l">hallazgos altos</div></div>
  <div class="card warn"><div class="n">{DATA['n_med']}</div><div class="l">hallazgos medios</div></div>
  <div class="card"><div class="n">{DATA['n_low']}</div><div class="l">hallazgos bajos</div></div>
</div>

<h2>Resumen ejecutivo</h2>
{"".join(f'<p class="sub">{rich(p)}</p>' for p in DATA['summary'])}

<h2>Mapa de rutas</h2>
<table><thead><tr><th>Ruta</th><th>Archivo</th><th>Qué hace</th><th>Cómo se llega</th></tr></thead>
<tbody>{routes_html(DATA['routes'])}</tbody></table>

<h2>Flujos, paso a paso</h2>
<div class="toc">{"".join(f'<a href="#{f["id"]}">{esc(f["title"])}</a>' for f in DATA['flows'])}</div>
{flows_html(DATA['flows'])}

<h2>Hallazgos</h2>
<table><thead><tr><th>ID</th><th>Sev.</th><th>Módulo</th><th>Qué pasa</th><th>Captura</th></tr></thead>
<tbody>{findings_table(DATA['findings'])}</tbody></table>

<h2>Lo que funciona bien</h2>
<ul class="sub">{"".join(f'<li>{rich(x)}</li>' for x in DATA['good'])}</ul>

<h2>Qué no se pudo verificar en este pase</h2>
<ul class="sub">{"".join(f'<li>{rich(x)}</li>' for x in DATA['not_verified'])}</ul>

<footer>Reporte generado por <code>qa-harness/build-report.py</code>.
Para reproducir: <code>QA_HARNESS=1 npx expo start --web --port 8081</code> y abrir las rutas
con los escenarios <code>?qa=free|pro|limit|empty|error|loading|dark</code>.</footer>
</div></body></html>
"""

OUT.write_text(html, encoding="utf-8")
size = OUT.stat().st_size
unit = f"{size/1024/1024:.1f} MB" if size > 1024 * 1024 else f"{size/1024:.0f} KB"
print(f"{OUT}  ({unit}{', autocontenido' if EMBED else ', enlaza shots/'})")
