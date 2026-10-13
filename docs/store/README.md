# Envío de la edición gratuita 1.0 — #234

Bible AI Honduras se prepara como app gratuita, sin compras ni suscripciones.
El plan único vive en [#234](https://github.com/luiscf1226/bible-ai-honduras/issues/234).
Los trabajos de pagos #143/#144 no bloquean este envío.

## Ficha configurada mediante la API Apple

Se cargaron en la ficha 1.0.0 (es-MX) el subtítulo, descripción de la edición
gratuita, keywords, categoría Reference, copyright y lanzamiento manual.
`app-store-config.json` reproduce esos campos sin credenciales, y
`eas metadata:push --profile production --non-interactive` los sincroniza.
Support URL usa temporalmente el inicio ya publicado (con contacto) hasta que
Pages despliegue `/soporte/`. Esto no envía la app a revisión ni configura
App Privacy o capturas. Precio Free, Honduras, contacto y acceso del revisor
se configuraron mediante la API; el build 26 ya se seleccionó tras procesado VALID.

## Materiales preparados

- `listing-es-HN.md`: copy sin ofertas Pro, con cuotas reales; adaptar al idioma
  es-MX de App Store Connect.
- `review-notes.md`: notas ES/EN, acceso de revisión, consentimiento y borrado.
- `app-privacy-testflight.md`: guía actualizada para cuenta, contenido sensible,
  lectura, fechas opcionales, identificador de instalación y diagnóstico.
- `privacy-policy.md` y `terms-of-use.md`: texto para la edición gratuita,
  sincronizado con las páginas HTML de `site/`.
- `screenshot-manifest.md`: recorridos y tamaños de capturas del build final.
- `site/soporte/index.html`: página de ayuda y contacto para Support URL.

URLs después de publicar Pages:

- Soporte: `https://luiscf1226.github.io/bible-ai-honduras/soporte/`
- Privacidad: `https://luiscf1226.github.io/bible-ai-honduras/privacidad/`
- Términos: `https://luiscf1226.github.io/bible-ai-honduras/terminos/`
- Eliminación: `https://luiscf1226.github.io/bible-ai-honduras/eliminar-cuenta/`

## Pendientes que estos archivos no certifican

1. Desplegar Pages para que los textos públicos coincidan con la edición.
2. Validar el IPA 1.0 en iPhone/iPad: login, consentimiento IA, módulos,
   cuotas, compartir, widgets, recordatorios y eliminación Convex/Clerk.
3. Capturar PNG reales del build final y subirlos a la ficha.
4. Preparar acceso de revisor compatible con correo/OAuth sin depender de
   pedir códigos al fundador; guardar los datos únicamente en App Store Connect.
5. Completar precio Free, Honduras, metadatos, edad, derechos, privacidad y
   contacto en el portal, seleccionar el build y enviar a revisión.
6. Confirmar membresía, configuración remota y permisos de contenido; #151/#152
   siguen pendientes y no se declara que haya revisión legal completada.
7. Obtener aprobación Apple, publicar manualmente y verificar instalación pública.

El ícono existente es 1024×1024 RGB. No faltan logo ni archivos de ficha por
crear; sí falta comprobar el artefacto nativo y ejecutar los pasos externos.
El backend temporal compartido está documentado en `docs/builds-beta.md` (#142).

## Verificación externa del 12 de octubre de 2026

- EAS build `ba1e624e-8d3e-461b-9713-0ff26f35b11d`: 1.0.0 (26), finalizada,
  compilada con Xcode 26.6; envío `889b1f6b-c790-4fdd-b463-41e25925cfed` terminado.
- Apple procesó el build como VALID e IN_BETA_TESTING. Se alineó la ficha a
  1.0.0 y se seleccionó ese build. Todavía no se envió a App Review.
- Precio base 0, disponibilidad Honduras, release manual, ficha es-MX y
  contacto de revisión se verificaron mediante la API Apple.
- Se creó una cuenta de revisión en Clerk y su perfil en Convex, con progreso
  Salmos 23, un guardado con nota de prueba, separador y plan Ansiedad. Su
  ingreso por email_code se verificó con el SDK/API. Las credenciales y el
  teléfono de contacto están solo en App Store Connect, no en git.
- Con otra cuenta desechable se probó la acción real de eliminación: devolvió
  `status: ok`, `clerk: deleted`, y el perfil Convex quedó ausente. Esto prueba
  el backend; falta recorrer las confirmaciones en la interfaz nativa.
- Salmos 23 devolvió sus 6 versículos RV1909. No se certifica aquí el conteo
  completo del corpus remoto.

**Bloqueo de registro por correo:** un alta sin contraseña quedó en
`missing_requirements` con `password` pendiente, mientras la UI solo pide
email/código. El ingreso de cuentas existentes por código sí se comprobó.
Hay que ajustar la configuración de alta de Clerk al flujo passwordless de la
app (o implementar un paso de contraseña con su diseño y pruebas) antes de
abrir el registro público. No resolverlo con un bypass de autenticación.

Siguen pendientes: esa configuración, prueba del IPA y capturas de iPhone/iPad,
publicar Pages, revisión de App Privacy/edad/derechos y App Review/publicación.
