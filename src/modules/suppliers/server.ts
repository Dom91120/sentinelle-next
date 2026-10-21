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
export function depuisFormulaire(f: FormData): Prisma.SupplierUncheckedUpdateInput {
  const kind = f.get("kind");
  const data: Prisma.SupplierUncheckedUpdateInput = {
    name: champ(f, "name"),
    kind: typeof kind === "string" && kind ? kind : "provider",
    notes: typeof f.get("notes") === "string" && f.get("notes") ? (f.get("notes") as string) : null,
  };
  for (const [nom, col] of TEXT_FIELDS)
    (data as Record<string, unknown>)[col] = champOuNull(f, nom);
  return data;
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
