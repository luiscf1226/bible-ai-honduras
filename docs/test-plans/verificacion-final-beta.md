# Verificación final de la beta en dispositivo (#37)

| Campo | Valor |
|-------|-------|
| Actualizado | 2026-09-12 |
| Build | `eas build -p ios --profile testflight` y `eas build -p android --profile apk` desde `master` |
| Backend | Convex **test** (`neighborly-kudu-508`) — el único con corpus |
| Dispositivos | 1 iPhone con notch/Dynamic Island + 1 Android con barra de gestos. Idealmente también una pantalla chica (iPhone SE o Android de 5") |
| Estado | **Sin correr.** Todo lo de abajo pasó tests y typecheck, nada se probó en un teléfono |

Cada fila enlaza al guion detallado del issue cuando existe. Marcar ✅ / ❌ y, si
falla, abrir un issue con plataforma, build y pasos.

## 1. Arranque y sesión

| # | Paso | Esperado | iOS | Android |
|---|------|----------|-----|---------|
| 1.1 | Instalar y abrir | Splash con el logo nuevo sobre crema, sin cuadrado blanco (#102, #133) | | |
| 1.2 | Mirar el icono en el launcher | Logo nuevo, no se corta en círculo/squircle (#136) | | |
| 1.3 | Entrar con Google → completar onboarding | Llega a Home | | |
| 1.4 | **Matar la app** y reabrir | Entra directo a Home, sin splash de login ni onboarding (#124, guion `verificacion-124-auth-sesion.md`) | | |
| 1.5 | Cerrar sesión, entrar con **el mismo** Google | No vuelve a mostrar el onboarding (#124) | | |
| 1.6 | Entrar con correo nuevo | Llega el código; "Reenviar" respeta el cooldown (#104, `verificacion-104-login-correo.md`) | | |

## 2. Navegación y UI

| # | Paso | Esperado | iOS | Android |
|---|------|----------|-----|---------|
| 2.1 | Abrir Voces, Historias, Preguntar, Ajustes, Historial y volver | Todas tienen ‹ y vuelven; el gesto/botón atrás de Android funciona (#106, #127) | | |
| 2.2 | Escribir en Sentir, Preguntar y Voces | El campo y el botón de enviar quedan visibles sobre el teclado (#105) | | |
| 2.3 | Sentir en pantalla chica | El CTA "Prepárame un devocional" se ve sin scroll (#109) | | |
| 2.4 | Generar un devocional y abrir Historias | Se ven los pasos de carga, no una pantalla congelada (#110) | | |

## 3. Compartir

| # | Paso | Esperado | iOS | Android |
|---|------|----------|-----|---------|
| 3.1 | Compartir por WhatsApp desde Home, Preguntar, Voces, Historias y el lector | Se abre WhatsApp y al volver la app **sigue abierta** (#103, `repro-103-share-crash.md`) | | |
| 3.2 | Abrir el share sheet y cancelar | Sin error ni spinner colgado | | |

## 4. Lectura

| # | Paso | Esperado | iOS | Android |
|---|------|----------|-----|---------|
| 4.1 | Home → Leer la Biblia → buscar "sal" | Filtra a Salmos al instante (#112) | | |
| 4.2 | Buscar "Juan 3:16" | "Ir directo a" abre el versículo (#112) | | |
| 4.3 | Buscar "amor" | Resultados con el término resaltado y "Ver más" (#112) | | |
| 4.4 | Leer Génesis 50 → Siguiente | Pasa a Éxodo 1 (#113) | | |
| 4.5 | Cambiar tamaño de letra, matar la app, volver | Se conserva el tamaño y aparece "Seguí leyendo" (#113) | | |
| 4.6 | Tocar un versículo → Preguntar / Guardar / Copiar | Abre el chat con el pasaje; aparece en Guardados; se copia (#113) | | |
| 4.7 | Empezar el plan anual → marcar el día | Avanza progreso y racha (#114) | | |
| 4.8 | Empezar el recorrido de Ansiedad | Convive con el plan anual sin reiniciarlo (#115) | | |
| 4.9 | Sentir → elegir "Ansiedad" → generar | Al final aparece el CTA del recorrido (#115) | | |
| 4.10 | Historias → abrir una escena → "Leer en la Biblia" | Abre el pasaje correcto en el lector (#115) | | |

## 5. Cuenta

| # | Paso | Esperado | iOS | Android |
|---|------|----------|-----|---------|
| 5.1 | Ajustes → Cerrar sesión | Vuelve al splash; no llegan más recordatorios (#107) | | |
| 5.2 | Ajustes → Eliminar mi cuenta con una cuenta de prueba | Borra todo; volver a registrarse crea cuenta limpia (#107, `verificacion-107-cuenta.md`) | | |

## Antes de lanzar (no es prueba de dispositivo)

- [ ] Revisión pastoral de los pasajes de los 6 recorridos — `docs/content/planes/README.md`.
- [ ] Producción: plan pago de Convex, corpus ingerido y Clerk live — `docs/builds-beta.md`.
