/** Annuaire des fournisseurs (port de app/suppliers.py). */
import type { Prisma } from "@/generated/prisma/client";
import { SUPPLIER_KIND_LABELS } from "@/lib/constantes";
import { champ, champOuNull } from "@/lib/forms-util";

export const SEARCH_FIELDS = [
  "name",
  "contactName",
  "email",
  "customerRef",
  "city",
  "commercialContact",
  "adminContact",
  "notes",
];

/** Champs texte simples du formulaire, versés tels quels : nom de champ → colonne. */
const TEXT_FIELDS: [string, keyof Prisma.SupplierUncheckedUpdateInput][] = [
  ["contact_name", "contactName"],
  ["phone", "phone"],
  ["support_phone", "supportPhone"],
  ["email", "email"],
  ["support_url", "supportUrl"],
  ["support_email", "supportEmail"],
  ["customer_ref", "customerRef"],
  ["hours", "hours"],
  ["hours2", "hours2"],
  ["address", "address"],
  ["postal_code", "postalCode"],
  ["city", "city"],
  ["website", "website"],
  ["commercial_contact", "commercialContact"],
  ["commercial_phone", "commercialPhone"],
  ["commercial_email", "commercialEmail"],
  ["admin_contact", "adminContact"],
  ["admin_phone", "adminPhone"],
  ["admin_email", "adminEmail"],
  ["dpo_contact", "dpoContact"],
  ["dpo_phone", "dpoPhone"],
  ["dpo_email", "dpoEmail"],
  // Le second commercial : le gabarit numérote le PRÉFIXE, le modèle le SUFFIXE.
  ["commercial2_contact", "commercialContact2"],
  ["commercial2_phone", "commercialPhone2"],
  ["commercial2_email", "commercialEmail2"],
];

export function kindLabel(s: { kind: string | null }): string {
  return SUPPLIER_KIND_LABELS[s.kind ?? ""] ?? s.kind ?? "";
}

/** `_fill` : les champs d'un fournisseur depuis le formulaire. */
/**
 * Les champs de l'onglet Contacts : l'assistance (portail, hotline, courriel, n° client,
 * horaires) et les quatre contacts (commercial 1 et 2, administratif, DPO).
 */
const CONTACT_PREFIXES = ["commercial", "commercial2", "admin", "dpo"];
const ASSISTANCE_FIELDS = [
  "support_url",
  "support_phone",
  "support_email",
  "customer_ref",
  "hours",
  "hours2",
];
const CONTACT_FIELDS = TEXT_FIELDS.filter(
  ([nom]) =>
    ASSISTANCE_FIELDS.includes(nom) || CONTACT_PREFIXES.some((p) => nom.startsWith(`${p}_`)),
);

function porteDesContacts(f: FormData): boolean {
  return CONTACT_FIELDS.some(([nom]) => f.has(nom));
}

/**
 * Le formulaire principal (Détails). Les contacts ne sont repris que si le formulaire les
 * porte (ancien formulaire, création par l'API) : l'onglet Contacts a le sien, et une
 * fiche enregistrée depuis Détails ne doit pas les effacer.
 */
export function depuisFormulaire(f: FormData): Prisma.SupplierUncheckedUpdateInput {
  const kind = f.get("kind");
  const data: Prisma.SupplierUncheckedUpdateInput = {
    name: champ(f, "name"),
    kind: typeof kind === "string" && kind ? kind : "provider",
    notes: typeof f.get("notes") === "string" && f.get("notes") ? (f.get("notes") as string) : null,
  };
  const avecContacts = porteDesContacts(f);
  for (const [nom, col] of TEXT_FIELDS) {
    if (!avecContacts && CONTACT_FIELDS.some(([n]) => n === nom)) continue;
    (data as Record<string, unknown>)[col] = champOuNull(f, nom);
  }
  return data;
}

/** Le formulaire de l'onglet Contacts : l'assistance et les contacts, rien d'autre. */
export function contactsDepuisFormulaire(f: FormData): Prisma.SupplierUncheckedUpdateInput {
  const data: Record<string, unknown> = {};
  for (const [nom, col] of CONTACT_FIELDS) data[col] = champOuNull(f, nom);
  return data as Prisma.SupplierUncheckedUpdateInput;
}

export function hasContacts(s: {
  commercialContact: string | null;
  commercialPhone: string | null;
  commercialEmail: string | null;
  commercialContact2: string | null;
  commercialPhone2: string | null;
  commercialEmail2: string | null;
  adminContact: string | null;
  adminPhone: string | null;
  adminEmail: string | null;
  dpoContact: string | null;
  dpoPhone: string | null;
  dpoEmail: string | null;
}): boolean {
  return [
    s.commercialContact,
    s.commercialPhone,
    s.commercialEmail,
    s.commercialContact2,
    s.commercialPhone2,
    s.commercialEmail2,
    s.adminContact,
    s.adminPhone,
    s.adminEmail,
    s.dpoContact,
    s.dpoPhone,
    s.dpoEmail,
  ].some(Boolean);
}
