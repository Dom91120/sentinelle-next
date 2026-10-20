/** Couleur principale personnalisable (Préférences → Apparence), port de tests/test_theming.py. */
import { describe, expect, it } from "vitest";
import { colorMix, normalizeColor, primaryCssOverride, tintedLogoSvg } from "./theming";

describe("theming", () => {
  it("normalize_color", () => {
    expect(normalizeColor("#AB12ef")).toBe("#ab12ef");
    expect(normalizeColor("  #123456 ")).toBe("#123456");
    expect(normalizeColor("")).toBe("");
    expect(normalizeColor("#12345")).toBe("");
    expect(normalizeColor("rouge")).toBe("");
    expect(normalizeColor("#12345g")).toBe("");
  });

  it("color_mix", () => {
    expect(colorMix("#000000", 0.5)).toBe("#808080");
    expect(colorMix("#ffffff", -0.5)).toBe("#808080");
    expect(colorMix("#4f46e5", 0)).toBe("#4f46e5");
  });

  it("surcharge CSS vide par défaut", () => {
    expect(primaryCssOverride("")).toBe("");
    expect(primaryCssOverride("pas-une-couleur")).toBe("");
  });

  it("la surcharge contient les variables", () => {
    const css = primaryCssOverride("#0d9488");
    expect(css).toContain("--primary:#0d9488");
    expect(css).toContain("--primary-dark:");
    expect(css).toContain("--primary-rgb:13,148,136");
    expect(css).toContain('data-theme="dark"');
  });

  it("fond de la page de connexion", () => {
    expect(primaryCssOverride("#0d9488")).toContain(
      ".login-container{background:linear-gradient(135deg,",
    );
  });

  it("logo teinté", () => {
    const svg = '<svg><path fill="#4f46e5"/></svg>';
    expect(tintedLogoSvg(svg, "")).toContain("#4f46e5");
    expect(tintedLogoSvg(svg, "#0d9488")).toContain("#0d9488");
    expect(tintedLogoSvg(svg, "#0d9488")).not.toContain("#4f46e5");
  });
});
