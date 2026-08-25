# Baton — Issue #8: UI Home

- Estado: listo para revisión
- Tipo: modificar — reemplazar el Home de muestra por el flujo progresivo del prototipo conectado a `convex/devotional.today`.
- Alcance: `app/(tabs)/home.tsx`; `.agentic/` para evidencia del flujo.
- Fuera de alcance: push (#10), compartir (#11), catálogo/backend editorial #9, tokens y archivos Convex generados.
- Progreso: se verificó el prototipo, los tokens y el contrato de `today`; el Home ya consulta `devotional.today`, muestra carga/error recuperable y expande imagen + reflexión del contenido curado.
- Evidencia: `npm run typecheck` y `npm test` correctos después del cambio (20 pruebas). El servidor web compiló el bundle, pero no pudo montar Home porque el worktree no tiene `EXPO_PUBLIC_CONVEX_URL` ni `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`; no se añadieron credenciales de prueba.
- Próximo: al integrar un `.env.local` autorizado, abrir Home, tocar `home-devotional-toggle` y confirmar que aparece/desaparece `home-devotional-expanded` con la respuesta real de Convex.
