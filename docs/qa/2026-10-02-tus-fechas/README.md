# QA — Tus fechas (#204)

Harness web (`QA_HARNESS=1`), 390×844, zona `America/Tegucigalpa`, reloj fijo
con Playwright. Escenarios nuevos: `?fechas=hoy` y `?fechas=1`.

- `inicio-antes-sin-fechas.png`: sin fechas el inicio queda igual que en `master`.
- `inicio-cumple-y-bautismo.png` / `inicio-cumple-oscuro.png`: cumpleaños y
  bautismo (hace 3 años) el mismo día, de día y de noche.
- `inicio-otro-dia-sin-tarjeta.png`: con fechas cargadas en otro día, no hay tarjeta.
- `inicio-29-feb-saluda-el-28.png`: cumpleaños 29/2, reloj en 28/2/2027 (no bisiesto).
- `mi-espacio-*.png`: sección Tus fechas vacía, con datos, editando, error de
  día inexistente (30 de febrero) y guardado.

El texto del versículo es el placeholder del harness (Salmos 46:1); la
referencia sí es la del catálogo curado. El aviso rojo "Convex functions should
not be imported in the browser" es del harness en dev y ya aparecía en `master`.
