import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { offerNotice, offerRetryable, paywallRenewalTerms, purchaseNotice } from "./paywallCopy";

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

  it("ni la pantalla ni el copy escriben un precio a mano", () => {
    const screen = readFileSync(resolve(__dirname, "../../app/paywall.tsx"), "utf8");
    const copy = readFileSync(resolve(__dirname, "./paywallCopy.ts"), "utf8");
    for (const source of [screen, copy]) {
      expect(source).not.toMatch(/\d+[.,]\d{2}/);
      expect(source).not.toContain("PAYWALL_DISPLAY_PRICE");
    }
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
