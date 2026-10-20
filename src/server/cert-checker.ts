/**
 * Lecture en direct des certificats TLS (port de app/cert_checker.py) : on se
 * connecte au domaine en TLS sans vérifier la chaîne, pour LIRE la date
 * d'expiration réelle (et l'émetteur), pas pour valider la confiance.
 */
import tls from "node:tls";

/** (host, port) d'une saisie souple : 'ex.fr', 'https://ex.fr/x', 'ex.fr:8443'. */
export function parseHostPort(domain: string, defaultPort = 443): [string, number] {
  let value = (domain || "").trim();
  if (!value) throw new Error("Domaine vide");
  if (value.includes("://")) {
    const u = new URL(value);
    if (!u.hostname) throw new Error(`Domaine invalide : ${domain}`);
    return [u.hostname, u.port ? Number(u.port) : defaultPort];
  }
  value = value.split("/", 1)[0];
  if (value.includes(":")) {
    const [host, portStr] = value.split(":");
    if (!host) throw new Error(`Domaine invalide : ${domain}`);
    return [host, /^\d+$/.test(portStr) ? Number(portStr) : defaultPort];
  }
  return [value, defaultPort];
}

function issuerName(cert: tls.DetailedPeerCertificate): string | null {
  const issuer = cert.issuer as Record<string, string | string[]> | undefined;
  if (!issuer) return null;
  const o = issuer.O ?? issuer.CN;
  if (!o) return null;
  return Array.isArray(o) ? o[0] : o;
}

/** {expiryDate, issuer} du certificat présenté par le domaine. Lève en cas d'échec. */
export function fetchCertInfo(
  domain: string,
  port?: number,
  timeoutMs = 10_000,
): Promise<{ expiryDate: Date; issuer: string | null }> {
  const [host, parsedPort] = parseHostPort(domain);
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port: port ?? parsedPort,
        servername: host,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          socket.end();
          if (!cert?.valid_to) {
            reject(new Error("Aucun certificat presente par le serveur"));
            return;
          }
          const d = new Date(cert.valid_to);
          const expiry = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          resolve({ expiryDate: expiry, issuer: issuerName(cert) });
        } catch (e) {
          reject(e);
        }
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error("timed out"));
    });
    socket.on("error", (e) => reject(e));
  });
}
