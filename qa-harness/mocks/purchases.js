// Oferta de RevenueCat (#144). Solo se usa si la app arrancó con
// EXPO_PUBLIC_REVENUECAT_API_KEY (ver qa-harness/README.md). `?rc=` elige:
//   (default) paquete mensual con precio localizado (`?precio=` lo cambia)
//   none      sin offering current
//   error     la tienda no responde (código de red del SDK)
//   cancel    la persona cancela la hoja de compra
function rcScenario() {
  if (typeof window === "undefined") return { mode: null, price: null };
  const params = new URLSearchParams(window.location.search);
  return { mode: params.get("rc"), price: params.get("precio") };
}

const Purchases = {
  configure: () => {},
  logIn: async () => ({}),
  logOut: async () => ({}),
  getOfferings: async () => {
    const { mode, price } = rcScenario();
    if (mode === "error") throw { code: "10", message: "Network error" };
    if (mode === "none") return { current: null };
    return {
      current: {
        monthly: {
          identifier: "$rc_monthly",
          product: { priceString: price || "US$4.99", title: "Bible AI Honduras Pro" },
        },
      },
    };
  },
  purchasePackage: async () => {
    const { mode } = rcScenario();
    if (mode === "cancel") throw { userCancelled: true };
    await new Promise((resolve) => setTimeout(resolve, 800));
    throw { code: "10", message: "Network error" };
  },
  restorePurchases: async () => ({ entitlements: { active: {} } }),
  setLogLevel: () => {}
};
export const LOG_LEVEL = { ERROR: "ERROR", DEBUG: "DEBUG" };
export default Purchases;
