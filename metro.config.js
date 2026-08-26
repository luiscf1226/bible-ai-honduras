// Config de Metro. Su única particularidad es el harness de QA: con
// QA_HARNESS=1 redirige los SDK externos (Clerk, Convex, RevenueCat,
// notificaciones) a los mocks de qa-harness/ para poder correr la app en el
// navegador sin credenciales. Sin esa variable, este archivo es la config por
// defecto de Expo y no altera ningún build. Ver qa-harness/README.md.
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
};

const defaultResolveRequest = config.resolver.resolveRequest;

// Opt-in: sin QA_HARNESS=1 este archivo no cambia nada del build normal.
const harnessEnabled = process.env.QA_HARNESS === "1";

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = harnessEnabled ? aliases[moduleName] : undefined;
  if (target && !context.originModulePath.includes("qa-harness")) {
    return { type: "sourceFile", filePath: target };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
