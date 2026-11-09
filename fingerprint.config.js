// Huella nativa de cada build (`runtimeVersion: fingerprint`): una
// actualización por EAS Update solo llega a builds con la misma huella. Sin
// la versión ni el número de build adentro: un cambio solo de JS llega
// también a quien tiene una versión de tienda anterior con el mismo nativo.
const { SourceSkips } = require("expo/fingerprint");

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: SourceSkips.ExpoConfigVersions | SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun,
};
