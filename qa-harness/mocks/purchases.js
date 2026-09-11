const Purchases = {
  configure: () => {},
  logIn: async () => ({}),
  logOut: async () => ({}),
  getOfferings: async () => ({ current: null }),
  purchasePackage: async () => ({}),
  restorePurchases: async () => ({ entitlements: { active: {} } }),
  setLogLevel: () => {}
};
export const LOG_LEVEL = { ERROR: "ERROR", DEBUG: "DEBUG" };
export default Purchases;
