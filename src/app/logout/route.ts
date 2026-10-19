import { headers } from "next/headers";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { getCurrentUser } from "@/server/guards";
import { redirection } from "@/server/http";

/** GET /logout (auth.logout) */
export async function GET() {
  const user = await getCurrentUser();
  if (user) {
    await auditRecord("deconnexion", "", "securite", user.username);
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch {
      // session déjà close
    }
  }
  return redirection("/login");
}
