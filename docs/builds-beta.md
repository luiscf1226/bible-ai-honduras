# Builds — entorno canónico y edición gratuita 1.0

La decisión vigente de #142 unifica temporalmente `apk`, `play`, `testflight`
y `production`: todos usan Convex `neighborly-kudu-508` y Clerk test
`moved-ram-3630`. Comparten usuarios, datos, cuotas y accesos. No borrar usuarios
públicos al limpiar pruebas. El deployment `optimistic-labrador-439` se conserva,
pero estos perfiles no lo usan. La descripción anterior de dos entornos activos
queda reemplazada por esta decisión; no se requiere crear Clerk live en #234.

## Configuración y comprobaciones

`eas.json` contiene las URL y keys públicas. No hay placeholders de Clerk en
production. Las claves privadas de OpenAI/Anthropic y `CLERK_SECRET_KEY` viven
en Convex, nunca en Expo. Verificar el issuer JWT de la misma instancia Clerk,
las funciones/índices desplegados y el corpus RV1909 (31.102 versículos) antes
de distribución. Esta configuración del repo no certifica el estado remoto.

La build enviada a App Store es la **1.0.0 (26)**. En master `app.json` declara
1.0.1 (betas TestFlight); EAS administra build numbers remotos con
`autoIncrement`. Mantener `com.bibleaihonduras.app` como bundle y el App Group
`group.com.bibleaihonduras.app` de los widgets.

La edición gratuita (build 26) sale del PR #237, que todavía no está en master:
ahí `src/lib/releaseConfig.ts` desactiva pagos incluso con una key RevenueCat
remota. Un build de master conserva la UI Pro; no enviarlo a App Review sin
integrar antes ese PR. Hoy EAS no tiene variables remotas (sin key RevenueCat). Las comprobaciones de actualización iOS
se desactivan hasta separar metadata pública del mínimo de builds TestFlight.
El enlace iOS ya apunta a App Store. No activar el piso compartido para usuarios
públicos cuando el build solo está en TestFlight.

## Build iOS desde Omarchy

Xcode no corre en Linux. Usar EAS cloud (o un Mac para build local):

```bash
npx eas-cli whoami
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --id <id-del-build-validado>
```

No usar `--latest` sin comprobar qué artefacto se selecciona. Confirmar Xcode
26 o posterior y SDK iOS 26 o posterior en los logs, firma/App Group, versión
1.0.0 y build number nuevo. El target mínimo iOS 17 no es la versión del SDK.
La selección automática de imagen de EAS requiere verificar el build resultante.

El submit `production` reutiliza la API key que ya está asignada a esta app
en EAS; no depende de copiar un `.p8` a la máquina. La firma remota y los
perfiles de app/widgets se comprobaron al preparar la build 26. El perfil
legacy `testflight` conserva la configuración por `.secrets/` de builds
anteriores. No subir credenciales al ticket ni crear/rotar una API key para
resolver el envío.

## Pruebas y publicación

TestFlight permite comprobar el IPA antes de seleccionarlo en la ficha 1.0.
Validar login de Apple/Google/correo, consentimiento IA, lector y funciones,
cuotas, compartir, widgets, recordatorios y borrado completo Convex/Clerk.
Para pruebas destructivas crear cuentas identificadas como desechables; registrar
sus IDs en un registro privado y limpiar solo esas cuentas.

Seguir el ticket #234 para capturas, metadatos, App Privacy, acceso de revisión,
App Review y lanzamiento manual. Un build subido a TestFlight todavía no es una
app publicada en App Store. Android/Google Play y pagos se siguen por separado.
