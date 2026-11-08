// En iOS/Android no hay DOM. El único que importa react-dom en el bundle nativo
// es @clerk/react: createPortal para sus componentes DOM (que en nativo nunca
// montan) y un registro de módulos para @clerk/ui en el navegador.
function webOnly(name) {
  return () => {
    throw new Error(`react-dom.${name} solo existe en web`);
  };
}

module.exports = {
  createPortal: webOnly("createPortal"),
  flushSync: (fn) => fn(),
  version: require("react").version,
};
