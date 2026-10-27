// Dos instancias de Clerk mientras dure la migración a producción:
// `CLERK_JWT_ISSUER_DOMAIN` es la de desarrollo (moved-ram-3630, la que trae
// la 1.0.1 publicada) y `CLERK_PROD_JWT_ISSUER_DOMAIN` la de producción (1.0.2
// en adelante). Convex acepta tokens de cualquiera de las dos; la que no esté
// configurada se omite para que el deploy no falle.
const issuers = [process.env.CLERK_JWT_ISSUER_DOMAIN, process.env.CLERK_PROD_JWT_ISSUER_DOMAIN];

export default {
  providers: issuers
    .filter((domain): domain is string => Boolean(domain))
    .map((domain) => ({ domain, applicationID: "convex" })),
};
