# Materiales de envío a App Store y Google Play (#38)

Este directorio reúne los materiales que se pueden preparar en el repositorio
para la ficha y revisión de tienda. No sustituye la configuración de los
portales de Apple o Google.

## Estado

| Entregable | Estado | Dependencia |
| --- | --- | --- |
| Manifiesto y guía de capturas | Listo para ejecutar | #37: pruebas E2E en dispositivo real |
| Notas de revisión (ES + EN) | Listas para adaptar al portal | Cuenta de revisor y productos finales |
| Política de privacidad | Borrador de contenido, **no publicado** | Dominio/URL, contacto responsable y revisión legal del titular |

No subir este borrador como si fuera una política publicada. Antes de enviar
una build, el responsable del producto debe publicar una URL HTTPS estable,
revisar el texto legal y reemplazar todos los campos entre corchetes.

## Archivos

- [screenshot-manifest.md](./screenshot-manifest.md): qué capturar, desde qué
  estado y cómo nombrar los archivos.
- [review-notes.md](./review-notes.md): texto bilingüe para App Review y Play
  Console, incluida la explicación de IA y contenido religioso.
- [privacy-policy-draft.md](./privacy-policy-draft.md): contenido verificado
  contra el repositorio que aún requiere publicación y revisión legal.

## Qué no certifica este paquete

- No certifica que las capturas se hayan tomado ni que representen una build de
  producción.
- No crea cuentas de Apple Developer, Google Play, Clerk, Convex o RevenueCat.
- No prueba compras reales, restauración ni los cinco módulos en dispositivos.
- No confirma licencias de contenido bíblico ni la disponibilidad de NVI; el
  PRD aún marca esa licencia como pendiente.

La evidencia de esas verificaciones pertenece a #37 y a los responsables de
las cuentas de distribución.
