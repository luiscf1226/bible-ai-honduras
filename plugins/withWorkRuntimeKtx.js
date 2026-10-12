const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Build de Android (Play #8): `react-native-android-widget` trae
 * `androidx.work:work-runtime:2.8.1` y otra dependencia trae
 * `work-runtime-ktx:2.7.1`. Desde WorkManager 2.8 las extensiones de Kotlin
 * viven dentro de `work-runtime` (y `-ktx` quedó vacío), así que las dos
 * versiones juntas traen las mismas clases y `checkReleaseDuplicateClasses`
 * falla. Se fuerza `-ktx` a la misma versión.
 */
const MARKER = "// withWorkRuntimeKtx";
const BLOCK = `
${MARKER}
configurations.all {
    resolutionStrategy {
        force "androidx.work:work-runtime-ktx:2.8.1"
    }
}
`;

module.exports = function withWorkRuntimeKtx(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += BLOCK;
    }
    return mod;
  });
};
