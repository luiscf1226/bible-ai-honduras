# Envío de la edición gratuita 1.0 — #234

Bible AI Honduras se prepara como app gratuita, sin compras ni suscripciones.
El plan único vive en [#234](https://github.com/luiscf1226/bible-ai-honduras/issues/234).
Los trabajos de pagos #143/#144 no bloquean este envío.

## Ficha configurada mediante la API Apple

Se cargaron en la ficha 1.0 (es-MX) el subtítulo, descripción de la edición
gratuita, keywords, categoría Reference, copyright y lanzamiento manual.
`app-store-config.json` reproduce esos campos sin credenciales, y
`eas metadata:push --profile production --non-interactive` los sincroniza.
Support URL usa temporalmente el inicio ya publicado (con contacto) hasta que
Pages despliegue `/soporte/`. Esto no envía la app a revisión ni configura
precio, países, App Privacy, capturas o acceso del revisor.

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
