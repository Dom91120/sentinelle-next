/** users/form.html */
import type { Role, User } from "@/generated/prisma/client";
import { EnteteForm, PiedForm, Section } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { ScriptDiffere } from "@/components/scripts";
import { roleLabel } from "@/modules/users/server";

const PW_JS = `(function () {
    var pw1 = document.getElementById('pw1'), pw2 = document.getElementById('pw2');
    if (!pw1 || !pw2) return;
    var msg = document.getElementById('pwMismatch');
    var form = pw1.closest('form');
    function check() {
        var bad = pw2.value && pw1.value !== pw2.value;
        if (msg) msg.classList.toggle('d-none', !bad);
        pw2.setCustomValidity(bad ? 'Les mots de passe ne correspondent pas.' : '');
        return !bad;
    }
    pw1.addEventListener('input', check);
    pw2.addEventListener('input', check);
    form.addEventListener('submit', function (e) {
        if (!check()) { e.preventDefault(); pw2.focus(); }
    });
})();`;

export function FormulaireUtilisateur({ user, roles, csrf, nonce }: { user: User | null; roles: Role[]; csrf: string; nonce?: string }) {
  const ldap = user?.authSource === "ldap";
  return (
    <>
      <EnteteForm titre={`${user ? "Modifier" : "Nouvel"} utilisateur`} retour="/users" />
      <div className="form-page">
        <nav className="form-sommaire" aria-label="Rubriques du formulaire" />
        <div className="form-corps">
          <div className="data-card p-4">
            <form method="POST" id="form-principal" className="formulaire">
              <input type="hidden" name="csrf_token" value={csrf} />
              <Section titre="Identité" icone="bi-person" couleur="indigo">
                <div className="mb-3">
                  <label className="form-label fw-medium">Nom d'utilisateur</label>
                  {user ? <input type="text" className="form-control" defaultValue={user.username} disabled /> : <input type="text" name="username" className="form-control" required placeholder="Nom d'utilisateur" />}
                </div>
                <div className="mb-3">
                  <label className="form-label fw-medium">Email *</label>
                  <input type="email" name="email" className="form-control" required defaultValue={user?.email ?? ""} placeholder="email@domaine.com" />
                </div>
              </Section>

              <Section titre="Mot de passe" icone="bi-shield-lock" couleur="rose">
                {ldap ? (
                  <div className="mb-3">
                    <label className="form-label fw-medium">Mot de passe</label>
                    <p className="text-muted small mb-0">
                      <Icone bi="bi-diagram-3" taille="1em" classes="me-1" />
                      Compte <strong>Active Directory</strong> : l'authentification et le mot de passe sont gérés par l'annuaire, pas ici.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-medium">Mot de passe {user ? "(laisser vide pour ne pas changer)" : "*"}</label>
                      <input type="password" name="password" id="pw1" className="form-control" required={!user} minLength={8} placeholder="Minimum 8 caracteres" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-medium">Confirmer le mot de passe {user ? "(idem)" : "*"}</label>
                      <input type="password" name="password_confirm" id="pw2" className="form-control" required={!user} minLength={8} placeholder="Ressaisir le mot de passe" />
                      <small className="text-danger d-none" id="pwMismatch">
                        <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
                        Les deux mots de passe ne correspondent pas.
                      </small>
                    </div>
                  </>
                )}
              </Section>

              <Section titre="Rôle" icone="bi-person-badge" couleur="violet">
                <div className="mb-3">
                  <label className="form-label fw-medium">Rôle *</label>
                  <select name="role" className="form-select" required defaultValue={user?.role ?? roles[0]?.name ?? "viewer"}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {roleLabel(r.name)}
                        {r.description ? ` — ${r.description}` : ""}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">
                    <a href="/users/roles">Gérer les rôles & permissions</a>
                  </small>
                </div>
              </Section>

              <PiedForm retour="/users" libelle={user ? "Enregistrer" : "Creer"} />
            </form>
          </div>
        </div>
      </div>
      <ScriptDiffere code={PW_JS} nonce={nonce} />
    </>
  );
}
