/** Parsing défensif des saisies (port de la partie pure de tests/test_corrections.py). */
import { describe, expect, it } from "vitest";
import { parseDate, parseFloat_, parseInt_ } from "./forms-util";

describe("forms-util", () => {
  it("parse_int tolère vide et invalide", () => {
    expect(parseInt_("", 90)).toBe(90);
    expect(parseInt_("abc", 90)).toBe(90);
    expect(parseInt_(null, 90)).toBe(90);
    expect(parseInt_("  7 ")).toBe(7);
    expect(parseInt_("-3", 0, 0)).toBe(0); // borné au minimum
  });

  it("parse_date tolère invalide", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("2026-13-40")).toBeNull();
    expect(parseDate("2026-06-30")).toEqual(new Date(Date.UTC(2026, 5, 30)));
  });

  it("parse_float à la française", () => {
    expect(parseFloat_("9 999 999,99")).toBe(9999999.99);
    expect(parseFloat_("9 999 999,99")).toBe(9999999.99);
    expect(parseFloat_("18 500,00 €")).toBe(18500);
    expect(parseFloat_("1.234,5")).toBe(1234.5);
    expect(parseFloat_("18500.5")).toBe(18500.5);
  });

  it("parse_float virgule et invalide", () => {
    expect(parseFloat_("1,5")).toBe(1.5);
    expect(parseFloat_("")).toBeNull();
    expect(parseFloat_("x", 0)).toBe(0);
  });
});
