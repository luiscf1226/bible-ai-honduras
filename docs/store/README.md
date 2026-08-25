# Materiales de envío a App Store y Google Play (#38)

Este directorio reúne los materiales que se pueden preparar en el repositorio
para la ficha y revisión de tienda. No sustituye la configuración de los
portales de Apple o Google.

## Estado

| Entregable | Estado | Dependencia |
| --- | --- | --- |
| Manifiesto y guía de capturas | Listo para ejecutar | #37: pruebas E2E en dispositivo real |
| Notas de revisión (ES + EN) | Listas para adaptar al portal | Cuenta de revisor y productos finales |
| Ficha de tienda (es-HN) | Lista para copiar | Precio y productos finales |
| Política de privacidad | Lista para publicar | Despliegue de GitHub Pages al fusionar el PR |

URL prevista de la política:
`https://luiscf1226.github.io/bible-ai-honduras/privacidad/`.

## Archivos

- [screenshot-manifest.md](./screenshot-manifest.md): qué capturar, desde qué
  estado y cómo nombrar los archivos.
- [review-notes.md](./review-notes.md): texto bilingüe para App Review y Play
  Console, incluida la explicación de IA y contenido religioso.
- [privacy-policy.md](./privacy-policy.md): copia editable de la política que
  se publica como HTML en GitHub Pages.
- [listing-es-HN.md](./listing-es-HN.md): título, subtítulo, descripción y
  palabras clave con conteos para App Store y Google Play.

## Qué no certifica este paquete

- No certifica que las capturas se hayan tomado ni que representen una build de
  producción.
- No crea cuentas de Apple Developer, Google Play, Clerk, Convex o RevenueCat.
- No prueba compras reales, restauración ni los cinco módulos en dispositivos.
- No confirma licencias de contenido bíblico ni la disponibilidad de NVI; el
  PRD aún marca esa licencia como pendiente.
- No resuelve el borrado completo de cuenta ni el consentimiento explícito
  antes de compartir texto con proveedores de IA; ambos son bloqueantes de
  cumplimiento de tienda y deben filarse aparte.
- La cuenta de Voyage AI debe tener activado y documentado el opt-out de uso
  para entrenamiento antes de volver a prometer «no se usa para entrenar» en
  producto o materiales.

La evidencia de esas verificaciones pertenece a #37 y a los responsables de
las cuentas de distribución.
