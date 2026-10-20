/** Vocabulaire unique : un mot par couleur, des délais en français (port de tests/test_libelles.py). */
import { describe, expect, it } from "vitest";
import {
  compte,
  dateLongue,
  delai,
  jours,
  montant,
  priorityLabel,
  STATUS_LABELS,
  statusLabel,
  statusLabelPlural,
} from "./libelles";

const d = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));

describe("libellés", () => {
  it("un montant en français", () => {
    expect(montant(32000)).toBe("32 000 €");
    expect(montant(1191.64)).toBe("1 191,64 €");
    expect(montant(0.5)).toBe("0,50 €");
    expect(montant(null)).toBe("");
    expect(montant("")).toBe("");
    expect(montant(12, "")).toBe("12");
  });

  it("un mot par couleur", () => {
    expect(statusLabel("danger")).toBe("Critique");
    expect(statusLabel("warning")).toBe("Urgent");
    expect(statusLabel("info")).toBe("À prévoir");
    expect(statusLabel("success")).toBe("OK");
    expect(statusLabel("pending")).toBe("Non suivi");
    expect(statusLabel(null)).toBe("Non suivi");
    expect(statusLabel("bizarre", "?")).toBe("?");
    expect(new Set(Object.values(STATUS_LABELS)).size).toBe(4);
  });

  it("pluriel et priorité", () => {
    expect(statusLabelPlural("danger")).toBe("critiques");
    expect(statusLabelPlural("warning")).toBe("urgents");
    expect(compte(1, "danger")).toBe("1 critique");
    expect(compte(2, "danger")).toBe("2 critiques");
    expect(compte(1, "warning")).toBe("1 urgent");
    expect(compte(3, "info")).toBe("3 à prévoir");
    expect(compte(4, "success")).toBe("4 OK");
    expect(priorityLabel("high")).toBe("Haute");
    expect(priorityLabel("critical")).toBe("Critique");
    expect(priorityLabel(null)).toBe("");
    expect(priorityLabel("inconnue")).toBe("inconnue");
  });

  it("délai relatif", () => {
    expect(delai(-5)).toBe("en retard de 5 j");
    expect(delai(0)).toBe("aujourd'hui");
    expect(delai(1)).toBe("demain");
    expect(delai(12)).toBe("dans 12 j");
    expect(delai(null)).toBe("");
    expect(delai(-2, "expiré depuis")).toBe("expiré depuis 2 j");
    expect(delai(-47, "préavis dépassé de")).toBe("préavis dépassé de 47 j");
  });

  it("date longue", () => {
    expect(dateLongue(d(2026, 9, 17))).toBe("jeudi 17 septembre 2026");
    expect(dateLongue(null)).toBe("");
  });

  it("délai depuis une date", () => {
    const today = d(2026, 9, 17);
    expect(jours(d(2026, 9, 29), today)).toBe(12);
    expect(delai(d(2026, 9, 29), undefined, undefined, today)).toBe("dans 12 j");
    expect(delai(new Date(Date.UTC(2026, 8, 12, 8, 0)), undefined, undefined, today)).toBe(
      "en retard de 5 j",
    );
    expect(delai(new Date(Date.now() + 3 * 86_400_000))).toBe("dans 3 j");
  });
});
