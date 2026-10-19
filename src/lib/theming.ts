/**
 * Couleur principale personnalisable de l'interface (port de app/theming.py).
 * Une couleur hex stockée en config (UI_PRIMARY_COLOR, vide = palette indigo).
 */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Retourne la couleur hex normalisée ('' si invalide/vide). */
export function normalizeColor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return HEX_RE.test(v) ? v.toLowerCase() : "";
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Mélange avec du blanc (ratio > 0) ou du noir (ratio < 0). */
export function colorMix(hex: string, ratio: number): string {
  const target = ratio >= 0 ? 255 : 0;
  const amount = Math.abs(ratio);
  const parts = rgb(hex).map((v) => Math.round(v + (target - v) * amount));
  return `#${parts.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Contenu du bloc <style> de surcharge des variables primaires ('' si défaut). */
export function primaryCssOverride(hexColor: string | null | undefined): string {
  const c = normalizeColor(hexColor);
  if (!c) return "";
  const dark = colorMix(c, -0.22);
  const rgbs = rgb(c).join(",");
  const l1 = colorMix(c, 0.45);
  const l2 = colorMix(c, 0.25);
  const lrgb = rgb(l1).join(",");
  const loginBg = `linear-gradient(135deg,${colorMix(c, -0.85)} 0%,${colorMix(c, -0.7)} 55%,${colorMix(c, -0.45)} 100%)`;
  return (
    `:root:root{--primary:${c};--primary-dark:${dark};--primary-rgb:${rgbs};--ring:0 0 0 3px rgba(${rgbs},.35);}` +
    `:root:root[data-theme="dark"]{--primary:${l1};--primary-dark:${l2};--primary-rgb:${lrgb};--ring:0 0 0 3px rgba(${lrgb},.35);}` +
    `.login-container{background:${loginBg};}`
  );
}

/** Couleur du logo SVG d'origine (public/img/logo.svg). */
const LOGO_COLOR = "#4f46e5";

/** Recolore le logo avec la couleur du site (si définie). */
export function tintedLogoSvg(svg: string, hexColor: string | null | undefined): string {
  const c = normalizeColor(hexColor);
  if (!c) return svg;
  return svg.split(LOGO_COLOR).join(c);
}
