/**
 * Démarrage global des tests d'intégration : un serveur Next sur la base de test.
 *
 * - SENTINELLE_TEST_URL donné : on s'y connecte (serveur déjà lancé, CI).
 * - Sinon `next dev` sur le port de test, répertoire de build `.next-test`
 *   (le serveur de développement du poste garde `.next`), arrêté à la fin.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { BASE_URL, envTest, PORT } from "./env";

let serveur: ChildProcess | null = null;

async function pret(url: string, delaiMs: number): Promise<boolean> {
  const fin = Date.now() + delaiMs;
  while (Date.now() < fin) {
    try {
      const r = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(3000) });
      if (r.status < 600) return true;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function setup(): Promise<void> {
  if (process.env.SENTINELLE_TEST_URL) {
    if (!(await pret(BASE_URL, 10_000)))
      throw new Error(`Aucun serveur de test ne répond sur ${BASE_URL}`);
    return;
  }
  if (await pret(BASE_URL, 1_000)) return; // déjà lancé (une autre session de tests)
  const mode = process.env.SENTINELLE_TEST_MODE ?? "dev";
  const args =
    mode === "start"
      ? ["exec", "next", "start", "-p", String(PORT)]
      : ["exec", "next", "dev", "-p", String(PORT)];
  serveur = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    env: { ...process.env, ...envTest(), NODE_OPTIONS: "--max-old-space-size=8192" },
    stdio: process.env.SENTINELLE_TEST_VERBOSE ? "inherit" : ["ignore", "ignore", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  });
  let erreurs = "";
  serveur.stderr?.on("data", (d) => {
    erreurs += String(d);
  });
  if (!(await pret(BASE_URL, 180_000))) {
    serveur.kill();
    throw new Error(`Le serveur de test ne démarre pas sur ${BASE_URL}\n${erreurs.slice(-2000)}`);
  }
}

export async function teardown(): Promise<void> {
  if (!serveur) return;
  if (process.platform === "win32" && serveur.pid) {
    spawn("taskkill", ["/pid", String(serveur.pid), "/T", "/F"], { windowsHide: true });
  } else {
    serveur.kill("SIGTERM");
  }
  serveur = null;
}
