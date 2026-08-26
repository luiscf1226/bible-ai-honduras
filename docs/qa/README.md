# Pases de QA

Cada carpeta es un pase completo de QA manual sobre una revisión concreta:
recorrido de los flujos, captura de cada pantalla y sus estados, y la lista de
hallazgos con severidad y `archivo:línea`.

| Pase | Revisión | Resultado |
|---|---|---|
| [2026-08-25](2026-08-25/index.html) | `871c0ad8` (master, tras el merge del PR #88) | 24 hallazgos — 6 altos, 8 medios, 10 bajos |

Abrí el `index.html` del pase en un navegador. Se generan con
`python3 qa-harness/build-report.py` a partir del `report-data.json` y los
`shots/` de cada carpeta; ver `qa-harness/README.md`.
