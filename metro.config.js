// Config de Metro. Dos particularidades:
//
// 1. Harness de QA: con QA_HARNESS=1 redirige los SDK externos (Clerk, Convex,
//    RevenueCat, notificaciones) a los mocks de qa-harness/ para poder correr la
//    app en el navegador sin credenciales. Ver qa-harness/README.md.
// 2. Bundle nativo (1.0.3): `nativeStubs` saca de iOS/Android código que solo
//    corre en web. Web no cambia.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const aliases = {
  "@clerk/expo": path.resolve(__dirname, "qa-harness/mocks/clerk.js"),
  "@clerk/expo/experimental": path.resolve(__dirname, "qa-harness/mocks/clerk-experimental.js"),
  "convex/react": path.resolve(__dirname, "qa-harness/mocks/convex-react.js"),
  "convex/react-clerk": path.resolve(__dirname, "qa-harness/mocks/convex-react-clerk.js"),
  "react-native-purchases": path.resolve(__dirname, "qa-harness/mocks/purchases.js"),
  "expo-notifications": path.resolve(__dirname, "qa-harness/mocks/notifications.js"),
  "@react-native-community/netinfo": path.resolve(__dirname, "qa-harness/mocks/netinfo.js"),
  "expo-local-authentication": path.resolve(__dirname, "qa-harness/mocks/local-authentication.js"),
};

// Paquetes que entran al bundle nativo por un import estático pero que en iOS y
// Android nunca se ejecutan. Juntos eran ~1,4 MB de JS y una fuente de 963 KB.
const nativeStubs = {
  // @clerk/react lo importa para sus componentes DOM.
  "react-dom": path.resolve(__dirname, "metro-stubs/react-dom.js"),
  "react-dom/client": path.resolve(__dirname, "metro-stubs/react-dom-client.js"),
  // SDK web de RevenueCat: react-native-purchases solo lo usa en Expo Go y web
  // ("browser mode"); un build con el módulo nativo nunca entra ahí.
  "@revenuecat/purchases-js-hybrid-mappings": path.resolve(__dirname, "metro-stubs/empty.js"),
  // expo-router la importa para NativeTabs en Android; la app usa js-tabs.
  "@expo-google-fonts/material-symbols/400Regular": path.resolve(__dirname, "metro-stubs/material-symbols.js"),
};

const defaultResolveRequest = config.resolver.resolveRequest;

// Opt-in: sin QA_HARNESS=1 los mocks no entran a ningún build.
const harnessEnabled = process.env.QA_HARNESS === "1";

// La app tira error en el import si faltan estas variables. Con el harness los
// SDK están mockeados, así que alcanzan valores ficticios. Se definen acá,
// antes de que Metro levante los workers de Babel que las inlinean; un valor
// ya presente en el entorno o en .env.local tiene prioridad.
if (harnessEnabled) {
  process.env.EXPO_PUBLIC_CONVEX_URL ||= "https://qa-harness.convex.cloud";
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||= "pk_test_qa_harness";
  // Deja que `src/lib/revenuecat.ts` use el mock del SDK en web (#144).
  process.env.EXPO_PUBLIC_QA_HARNESS = "1";
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = harnessEnabled ? aliases[moduleName] : undefined;
  if (target && !context.originModulePath.includes("qa-harness")) {
    return { type: "sourceFile", filePath: target };
  }
  const stub = platform === "ios" || platform === "android" ? nativeStubs[moduleName] : undefined;
  if (stub) {
    return { type: "sourceFile", filePath: stub };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
