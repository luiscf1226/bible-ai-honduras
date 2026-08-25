# Baton — Issue #11: Compartir devocional desde Home

- Estado: listo para revisión
- Tipo: modificar — añadir la acción de compartir al devocional expandido existente.
- Alcance: `app/(tabs)/home.tsx`, helper puro y su prueba; consumir `src/lib/share.ts` y `api.users.current`.
- Fuera de alcance: recordatorios #10, pantallas de historias, cambios a Convex, tokens y una implementación local de compartir.
- Plan:
  1. [completed] Revisar el prototipo, tokens, servicio común y query de usuario.
  2. [completed] Crear texto compartible y conectar el botón de Home al share sheet común.
  3. [completed] Ejecutar pruebas, typecheck, export y revisar el diff.
- Evidencia: el botón `shareDevo` existe en el bloque de devocional expandido del prototipo; `shareContent` añade el referral link desde un dueño único. `npm test` pasó con 35 pruebas, `npm run typecheck` pasó y `npm run export` pasó para web, iOS y Android.
