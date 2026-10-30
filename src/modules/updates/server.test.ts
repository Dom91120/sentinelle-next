/** « Marquer à jour » : la règle de recopie des versions (partie pure de la route). */
import { describe, expect, it } from "vitest";
import {
  badgeVersion,
  commentaireMarquage,
  donneesSimples,
  filtresLigne,
  marquage,
  statutEnregistre,
} from "./server";

describe("marquage", () => {
  it("la version actuelle rejoint la dernière disponible", () => {
    expect(
      marquage({ currentVersion: "5.6.35", latestVersion: "5.6.36", softwareId: null }),
    ).toEqual({ currentVersion: "5.6.36", logiciel: null });
  });

  it("sans dernière version, la version actuelle reste telle quelle", () => {
    expect(marquage({ currentVersion: "5.6.35", latestVersion: null, softwareId: null })).toEqual({
      currentVersion: "5.6.35",
      logiciel: null,
    });
    expect(marquage({ currentVersion: "5.6.35", latestVersion: "", softwareId: null })).toEqual({
      currentVersion: "5.6.35",
      logiciel: null,
    });
  });

  it("le logiciel rattaché reçoit la même version", () => {
    expect(marquage({ currentVersion: "5.6.35", latestVersion: "5.6.36", softwareId: 48 })).toEqual(
      { currentVersion: "5.6.36", logiciel: { id: 48, version: "5.6.36" } },
    );
    expect(marquage({ currentVersion: "5.6.35", latestVersion: null, softwareId: 48 })).toEqual({
      currentVersion: "5.6.35",
      logiciel: { id: 48, version: "5.6.35" },
    });
  });

  it("une version vide n'écrase pas celle du logiciel", () => {
    expect(marquage({ currentVersion: null, latestVersion: null, softwareId: 48 })).toEqual({
      currentVersion: null,
      logiciel: null,
    });
    expect(marquage({ currentVersion: "", latestVersion: "", softwareId: 48 })).toEqual({
      currentVersion: "",
      logiciel: null,
    });
  });
});

describe("statutEnregistre", () => {
  it("la case cochée vaut critique, quelles que soient les versions", () => {
    expect(statutEnregistre(true, "1", "1")).toBe("critical");
    expect(statutEnregistre(true, null, null)).toBe("critical");
  });

  it("décochée, le statut se déduit des versions", () => {
    expect(statutEnregistre(false, "8.5.3.4", "8.5.3.8")).toBe("update_available");
    expect(statutEnregistre(false, null, "8.5.3.8")).toBe("update_available");
    expect(statutEnregistre(false, "8.5.3.8", "8.5.3.8")).toBe("up_to_date");
    expect(statutEnregistre(false, "8.5.3.8", null)).toBe("up_to_date");
    expect(statutEnregistre(false, null, null)).toBe("up_to_date");
  });
});

describe("donneesSimples", () => {
  it("« Date MAJ » vide conserve la date mémorisée", () => {
    expect(donneesSimples({ name: "AutoCAD", lastUpdate: null })).toEqual({ name: "AutoCAD" });
  });

  it("« Date MAJ » saisie la remplace", () => {
    const d = new Date("2026-10-30T00:00:00Z");
    expect(donneesSimples({ name: "AutoCAD", lastUpdate: d })).toEqual({
      name: "AutoCAD",
      lastUpdate: d,
    });
  });
});

describe("commentaireMarquage", () => {
  it("mentionne la version de départ quand elle est connue", () => {
    expect(commentaireMarquage("8.5.3.4", "8.5.3.8", new Date("2026-10-30T00:00:00Z"))).toBe(
      "Mis à jour de la version 8.5.3.4 en version 8.5.3.8 le 30/10/2026",
    );
  });

  it("s'en passe si elle est vide ou identique", () => {
    expect(commentaireMarquage(null, "3", null)).toBe("Mis à jour en version 3");
    expect(commentaireMarquage(" ", "3", null)).toBe("Mis à jour en version 3");
    expect(commentaireMarquage("3", "3", null)).toBe("Mis à jour en version 3");
    expect(commentaireMarquage("2", null, null)).toBe("Mis à jour de la version 2 en version ?");
  });
});

describe("badgeVersion", () => {
  it("« Mise à jour disponible » dès qu'une nouvelle version est connue, critique ou non", () => {
    expect(badgeVersion({ status: "critical", currentVersion: "4", latestVersion: "5" })).toEqual({
      cle: "update_available",
      libelle: "Mise à jour disponible",
      couleur: "warning",
    });
    expect(
      badgeVersion({ status: "up_to_date", currentVersion: "8.5.3.4", latestVersion: "8.5.3.8" }),
    ).toEqual({ cle: "update_available", libelle: "Mise à jour disponible", couleur: "warning" });
    expect(
      badgeVersion({ status: "update_available", currentVersion: null, latestVersion: null }),
    ).toEqual({ cle: "update_available", libelle: "Mise à jour disponible", couleur: "warning" });
  });

  it("« À jour » sinon, même pour une fiche critique", () => {
    expect(badgeVersion({ status: "up_to_date", currentVersion: "3", latestVersion: "3" })).toEqual(
      { cle: "up_to_date", libelle: "À jour", couleur: "success" },
    );
    expect(badgeVersion({ status: "critical", currentVersion: "4", latestVersion: "4" })).toEqual({
      cle: "up_to_date",
      libelle: "À jour",
      couleur: "success",
    });
  });
});

describe("filtresLigne", () => {
  it("critique et disponible appartiennent à deux filtres", () => {
    expect(filtresLigne({ status: "critical", currentVersion: "4", latestVersion: "5" })).toBe(
      "danger warning",
    );
    expect(filtresLigne({ status: "critical", currentVersion: "4", latestVersion: "4" })).toBe(
      "danger success",
    );
  });

  it("sinon le seul filtre du badge de version", () => {
    expect(
      filtresLigne({ status: "up_to_date", currentVersion: "8.5.3.4", latestVersion: "8.5.3.8" }),
    ).toBe("warning");
    expect(filtresLigne({ status: "up_to_date", currentVersion: "3", latestVersion: "3" })).toBe(
      "success",
    );
  });
});
