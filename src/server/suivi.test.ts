/** Les paramètres reçus par l'API chatIA (partie pure de tests/test_api_chatia.py). */
import { describe, expect, it } from "vitest";
import {
  HORIZON_DEFAUT,
  lireHorizon,
  lireOui,
  lireRecherche,
  lireTypes,
  simplifier,
} from "./suivi";

describe("paramètres chatIA", () => {
  it("horizon : défaut, bornes, invalides", () => {
    expect(lireHorizon(null)).toBe(HORIZON_DEFAUT);
    expect(lireHorizon("")).toBe(HORIZON_DEFAUT);
    expect(lireHorizon("30")).toBe(30);
    expect(lireHorizon("0")).toBe(0);
    for (const brut of ["-1", "abc", "9999"])
      expect(() => lireHorizon(brut), brut).toThrow(/« dans »/);
  });

  it("types : répétés ou séparés par des virgules, inconnus refusés", () => {
    expect(lireTypes(["sauvegarde", "mise_a_jour"])).toEqual(["sauvegarde", "mise_a_jour"]);
    expect(lireTypes(["sauvegarde,mise_a_jour"])).toEqual(["sauvegarde", "mise_a_jour"]);
    expect(lireTypes([" Certificat , certificat"])).toEqual(["certificat"]);
    expect(lireTypes([])).toEqual([]);
    expect(() => lireTypes(["imprimante"])).toThrow(/Type inconnu : imprimante/);
  });

  it("oui / non", () => {
    for (const v of ["1", "true", "oui", "yes", " OUI "]) expect(lireOui(v), v).toBe(true);
    for (const v of ["", "0", "non", null]) expect(lireOui(v), String(v)).toBe(false);
  });

  it("recherche : de 2 à 100 caractères, espaces réduits", () => {
    expect(lireRecherche("  portail   web ")).toBe("portail web");
    for (const q of ["", "a", "x".repeat(101)]) expect(() => lireRecherche(q)).toThrow(/« q »/);
  });

  it("simplifier : minuscules sans accents", () => {
    expect(simplifier("Échéance")).toBe("echeance");
    expect(simplifier("Élus - Mme EXEMPLE Anne")).toBe("elus - mme exemple anne");
  });
});
