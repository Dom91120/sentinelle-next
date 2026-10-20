import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { resetTwoFactor } from "@/server/two-factor";

/** POST /users/<id>/reset-2fa */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return traiterFormulaire(req, async () => {
    const admin = await requireAdmin();
    const user = await prisma.user.findUnique({
      where: { id },
      include: { twofactor: { select: { verified: true } } },
    });
    if (!user) return pasTrouve();
    if (!(user.twoFactorEnabled && user.twofactor.some((t) => t.verified)))
      return redirigerAvecMessage(
        "/users",
        `La 2FA n'est pas active pour ${user.username}.`,
        "info",
      );
    await resetTwoFactor(id);
    await auditRecord("reinitialisation 2FA", user.username, "utilisateurs", admin.username);
    return redirigerAvecMessage(
      "/users",
      `2FA desactivee pour ${user.username}. Il pourra la reactiver depuis son profil.`,
      "success",
    );
  });
}
