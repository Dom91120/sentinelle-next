/**
 * Initialisation d'une base (port des amorçages de create_app dans app/__init__.py) :
 *   - rôles par défaut (admin / editor / viewer) et héritage des droits ;
 *   - référentiels (listes administrables) ;
 *   - compte « admin » avec un mot de passe aléatoire affiché en console
 *     (ou ADMIN_INITIAL_PASSWORD), réinitialisé s'il vaut encore « admin » ;
 *   - configuration applicative copiée du .env si la table est vide.
 *
 * Idempotent : relançable sans dupliquer ni écraser ce que l'administrateur a édité.
 *
 *   pnpm db:init
 */
import "dotenv/config";
import { amorcer } from "@/server/amorcage";
import { prisma } from "@/server/db";

amorcer({ annoncer: true })
  .then(() => console.log("✓ Initialisation terminée."))
  .catch((e) => {
    console.error(e instanceof Error ? `✗ ${e.message}` : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
