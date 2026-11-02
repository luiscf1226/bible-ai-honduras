const { AndroidConfig, withInfoPlist, withStringsXml } = require("expo/config-plugins");

/**
 * Nombre visible "3C" (rechazo 2.1(a) de la 1.0.2, pantalla blanca al abrir).
 *
 * En iOS `expo.name` es también el nombre del target, del ejecutable y del
 * módulo de Swift. "3C" empieza con un dígito, así que Xcode llama al módulo
 * `_C` mientras el ejecutable sigue siendo `3C`. expo-modules-core busca la
 * clase `<CFBundleExecutable>.ExpoModulesProvider` (`3C.ExpoModulesProvider`),
 * no la encuentra y arranca sin ningún módulo nativo de Expo: el JS se cae con
 * "Cannot find native module 'ExpoAsset'" y la pantalla queda en blanco.
 *
 * Por eso `expo.name` vuelve a "Bible AI Honduras" (identificador válido, el
 * del build 29) y este plugin pone el nombre que ve la persona: el de la
 * pantalla de inicio en iOS y la etiqueta de la app en Android.
 */
const DISPLAY_NAME = "3C";

module.exports = function withDisplayName(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.CFBundleDisplayName = DISPLAY_NAME;
    return mod;
  });
  return withStringsXml(config, (mod) => {
    mod.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: "app_name", translatable: "false" }, _: DISPLAY_NAME }],
      mod.modResults,
    );
    return mod;
  });
};
