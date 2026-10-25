import { redirect } from "next/navigation";

/** Les référentiels se gèrent dans Préférences › Données › Référentiels ; l'ancienne adresse y mène. */
export default function Referentiels() {
  redirect("/preferences#secReferentiels");
}
