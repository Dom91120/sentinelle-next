/**
 * Un client HTTP de test, à la manière de `app.test_client()` de Flask : un pot de
 * cookies, le jeton CSRF recopié dans chaque formulaire, les redirections suivies à
 * la demande, et la connexion en admin en une ligne.
 */
import { ADMIN_PASSWORD, BASE_URL } from "./env";

export type Reponse = {
  status: number;
  headers: Headers;
  location: string | null;
  text: string;
  json<T = unknown>(): T;
  /** Le type MIME sans ses paramètres (`mimetype` de Flask). */
  mimetype: string;
};

export type Options = {
  headers?: Record<string, string>;
  /** Suit les redirections (follow_redirects=True). */
  followRedirects?: boolean;
  /** Formulaire multipart (fichiers) plutôt qu'urlencodé. */
  files?: Record<string, { name: string; content: Buffer | string; type?: string }>;
};

export type Donnees = Record<string, string | number | boolean | null | undefined | string[]>;

export class ClientTest {
  private cookies = new Map<string, string>();
  constructor(readonly base = BASE_URL) {}

  cookie(nom: string): string | undefined {
    return this.cookies.get(nom);
  }

  setCookie(nom: string, valeur: string): void {
    this.cookies.set(nom, valeur);
  }

  private enteteCookies(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private absorber(r: Response): void {
    for (const sc of r.headers.getSetCookie()) {
      const [paire, ...attrs] = sc.split(";");
      const i = paire.indexOf("=");
      const nom = paire.slice(0, i).trim();
      const valeur = paire.slice(i + 1).trim();
      const expire = attrs.some((a) => /max-age=0|expires=thu, 01 jan 1970/i.test(a.trim()));
      if (expire || valeur === "") this.cookies.delete(nom);
      else this.cookies.set(nom, valeur);
    }
  }

  private async envoyer(
    method: string,
    chemin: string,
    body: BodyInit | null,
    headers: Record<string, string>,
    follow: boolean,
    sauts = 0,
  ): Promise<Reponse> {
    const url = chemin.startsWith("http") ? chemin : `${this.base}${chemin}`;
    const r = await fetch(url, {
      method,
      body,
      headers: { ...headers, cookie: this.enteteCookies() },
      redirect: "manual",
    });
    this.absorber(r);
    const location = r.headers.get("location");
    if (follow && location && r.status >= 300 && r.status < 400 && sauts < 8) {
      await r.arrayBuffer();
      return this.envoyer("GET", location, null, {}, true, sauts + 1);
    }
    const text = await r.text();
    const ct = r.headers.get("content-type") ?? "";
    return {
      status: r.status,
      headers: r.headers,
      location,
      text,
      json: <T>() => JSON.parse(text) as T,
      mimetype: ct.split(";")[0].trim(),
    };
  }

  async get(chemin: string, opts: Options = {}): Promise<Reponse> {
    return this.envoyer("GET", chemin, null, opts.headers ?? {}, Boolean(opts.followRedirects));
  }

  /** Le jeton CSRF : celui du cookie, obtenu au besoin par un premier GET. */
  private async csrf(): Promise<string> {
    if (!this.cookies.get("sentinelle_csrf")) await this.get("/login");
    return this.cookies.get("sentinelle_csrf") ?? "";
  }

  async post(chemin: string, data: Donnees = {}, opts: Options = {}): Promise<Reponse> {
    const csrf = await this.csrf();
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    let body: BodyInit;
    if (opts.files) {
      const fd = new FormData();
      fd.set("csrf_token", csrf);
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined || v === null) continue;
        for (const x of Array.isArray(v) ? v : [v]) fd.append(k, String(x));
      }
      for (const [k, f] of Object.entries(opts.files)) {
        fd.set(
          k,
          new Blob(
            [new Uint8Array(typeof f.content === "string" ? Buffer.from(f.content) : f.content)],
            { type: f.type ?? "application/octet-stream" },
          ),
          f.name,
        );
      }
      body = fd;
    } else {
      const p = new URLSearchParams();
      p.set("csrf_token", csrf);
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined || v === null) continue;
        for (const x of Array.isArray(v) ? v : [v]) p.append(k, String(x));
      }
      body = p;
      headers["content-type"] = "application/x-www-form-urlencoded";
    }
    return this.envoyer("POST", chemin, body, headers, Boolean(opts.followRedirects));
  }

  /** GET d'un contenu binaire (archive, PDF) : les octets, le statut et les en-têtes. */
  async getBinaire(chemin: string): Promise<{ status: number; headers: Headers; octets: Buffer }> {
    const r = await fetch(`${this.base}${chemin}`, {
      headers: { cookie: this.enteteCookies() },
      redirect: "manual",
    });
    this.absorber(r);
    return { status: r.status, headers: r.headers, octets: Buffer.from(await r.arrayBuffer()) };
  }

  /** POST d'un corps JSON (le `client.post(url, json=...)` de Flask), jeton CSRF en en-tête. */
  async postJson(chemin: string, data: unknown, opts: Options = {}): Promise<Reponse> {
    const csrf = await this.csrf();
    return this.envoyer(
      "POST",
      chemin,
      JSON.stringify(data),
      { ...(opts.headers ?? {}), "content-type": "application/json", "x-csrftoken": csrf },
      Boolean(opts.followRedirects),
    );
  }

  /** Connexion par le formulaire de Sentinelle. */
  async login(
    username = "admin",
    password = ADMIN_PASSWORD,
    headers: Record<string, string> = {},
  ): Promise<Reponse> {
    return this.post("/login", { username, password }, { headers });
  }
}

/** Un client déjà connecté en admin (la fixture `client` de conftest.py). */
export async function clientAdmin(): Promise<ClientTest> {
  const c = new ClientTest();
  const r = await c.login();
  if (!(r.status >= 300 && r.status < 400 && !(r.location ?? "").includes("/login"))) {
    throw new Error(`Connexion admin impossible (${r.status} → ${r.location})`);
  }
  return c;
}
