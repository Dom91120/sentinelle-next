/** Lecture et écriture CSV : séparateur détecté, guillemets, formules neutralisées. */
import { describe, expect, it } from "vitest";
import { csvSafe, lireCsv, templateCsv } from "./csv-io";

describe("csv-io", () => {
  it("détecte le séparateur et respecte les guillemets", () => {
    expect(lireCsv('a;b;c\r\n1;"x;y";3\n')).toEqual([
      ["a", "b", "c"],
      ["1", "x;y", "3"],
    ]);
    expect(lireCsv('a,b\n"il a dit ""oui""",2')).toEqual([
      ["a", "b"],
      ['il a dit "oui"', "2"],
    ]);
  });

  it("neutralise l'injection de formules", () => {
    expect(csvSafe("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
    expect(csvSafe("+1")).toBe("'+1");
    expect(csvSafe("texte")).toBe("texte");
    expect(csvSafe("")).toBe("");
  });

  it("le modèle porte la colonne equipment et un BOM", () => {
    for (const key of ["certificates", "backups", "updates"]) {
      const texte = templateCsv(key);
      expect(texte.startsWith("﻿")).toBe(true);
      expect(texte.split("\r\n")[0]).toContain("equipment");
    }
  });
});
