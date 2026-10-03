import { describe, expect, it } from "vitest";

import * as copy from "./paywallCopy";
import { offerNotice, offerRetryable, paywallPriceHint, paywallRenewalTerms, purchaseNotice } from "./paywallCopy";

describe("copy del paywall (#144)", () => {
  it("los términos llevan el precio de la tienda, la duración y la renovación", () => {
    const terms = paywallRenewalTerms({ priceString: "L 124.00", productName: "Bible AI Honduras Pro" });
    expect(terms).toContain("L 124.00");
    expect(terms).toContain("mensual");
    expect(terms).toContain("Se renueva automáticamente");
    expect(terms).toContain("Bible AI Honduras Pro");
  });

  it("sin nombre de la tienda usa el de la app", () => {
    expect(paywallRenewalTerms({ priceString: "US$4.99", productName: "  " })).toMatch(/^Bible AI Honduras Pro:/);
  });

  it("el copy no trae un precio escrito a mano", () => {
    expect(copy).not.toHaveProperty("PAYWALL_DISPLAY_PRICE");
    expect(paywallPriceHint()).not.toMatch(/\d/);
    expect(paywallRenewalTerms({ priceString: "<precio>" }).replace("24 horas", "")).not.toMatch(/\d/);
  });

  it("mientras carga avisa; con precio no hay aviso", () => {
    expect(offerNotice(undefined)).toContain("Buscando el precio");
    expect(offerNotice({ ok: true, offer: { priceString: "US$4.99", title: null } })).toBeNull();
  });

  it("solo los fallos de red y de offering se pueden reintentar", () => {
    expect(offerRetryable({ ok: false, reason: "network_error" })).toBe(true);
    expect(offerRetryable({ ok: false, reason: "offering_unavailable" })).toBe(true);
    expect(offerRetryable({ ok: false, reason: "not_configured" })).toBe(false);
    expect(offerRetryable({ ok: false, reason: "dev_build_required" })).toBe(false);
    expect(offerRetryable(undefined)).toBe(false);
  });

  it("cancelar la compra no es un error; los demás fallos tienen su aviso", () => {
    expect(purchaseNotice({ ok: false, reason: "user_cancelled" }, "purchase")).toBeNull();
    expect(purchaseNotice({ ok: true }, "purchase")).toBeNull();
    expect(purchaseNotice({ ok: false, reason: "network_error" }, "purchase")).toContain("conexión");
    expect(purchaseNotice({ ok: false, reason: "purchase_failed" }, "restore")).toContain("restaurar");
    expect(purchaseNotice({ ok: false, reason: "offering_unavailable" }, "purchase")).toContain("no está disponible");
  });
});
