// Rückwärts-Rätsel / Backwords – Push-Benachrichtigung an den Gegner.
// Supabase Edge Function "notify". Die App ruft sie nach jedem Zug auf:
//   POST /functions/v1/notify  { "game_id": "..." }   (mit dem Login-Token des Spielers)
// Benötigte Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (z. B. https://deine-seite)
// SUPABASE_URL und der Service-Key werden von Supabase automatisch bereitgestellt.

const env = (k: string): string => (globalThis as any).Deno?.env?.get(k) ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ------------------------------------------------------------------ base64url
export function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64uDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const enc = new TextEncoder();

// ------------------------------------------------------------------ VAPID (RFC 8292)
export async function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const pub = b64uDecode(publicKey);
  const jwk = { kty: "EC", crv: "P-256", d: privateKey, x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64uEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject };
  const body = b64uEncode(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${body}`));
  return `vapid t=${header}.${body}.${b64uEncode(sig)}, k=${publicKey}`;
}

// ------------------------------------------------------------------ Payload encryption (RFC 8291, aes128gcm)
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

export async function encryptPayload(p256dh: string, authSecret: string, payload: Uint8Array,
                                     saltIn?: Uint8Array, serverKeys?: CryptoKeyPair): Promise<Uint8Array> {
  const uaPublic = b64uDecode(p256dh);
  const auth = b64uDecode(authSecret);
  const asKeys = serverKeys ?? await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = saltIn ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}

export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, message: object,
                               vapid: { publicKey: string; privateKey: string; subject: string },
                               fetchFn: typeof fetch = fetch): Promise<number> {
  const body = await encryptPayload(sub.p256dh, sub.auth, enc.encode(JSON.stringify(message)));
  const res = await fetchFn(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
  return res.status;
}

// ------------------------------------------------------------------ Texte
const TEXT: Record<string, Record<string, (n: string, a: number, b: number) => [string, string]>> = {
  de: {
    challenge: (n) => [`${n} fordert dich heraus!`, "Neues Rückwärts-Duell: Hör dir das erste Wort an."],
    guess:     (n) => [`${n} hat gespielt`, "Du bist dran: Rate das Rückwärts-Wort!"],
    rerecord:  (n) => [`${n} will's nochmal hören`, "Sprich dein Wort bitte noch einmal ein."],
    finished:  (n, a, b) => [`Duell gegen ${n} beendet`, `Endstand ${a}:${b}. Schau dir das Ergebnis an.`],
    gaveup:    (n) => [`${n} hat aufgegeben`, "Du gewinnst das Duell!"],
  },
  en: {
    challenge: (n) => [`${n} challenges you!`, "New Backwords duel: listen to the first word."],
    guess:     (n) => [`${n} played`, "Your turn: guess the backwards word!"],
    rerecord:  (n) => [`${n} wants to hear it again`, "Please record your word one more time."],
    finished:  (n, a, b) => [`Duel with ${n} is over`, `Final score ${a}:${b}. Check the result.`],
    gaveup:    (n) => [`${n} gave up`, "You win the duel!"],
  },
};

// ------------------------------------------------------------------ Handler
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function serviceKey(): string {
  const legacy = env("SUPABASE_SERVICE_ROLE_KEY") || env("RR_SERVICE_KEY");
  if (legacy) return legacy;
  try { const all = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); return Object.values(all)[0] as string || ""; }
  catch { return ""; }
}

export async function handle(req: Request, fetchFn: typeof fetch = fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = env("SUPABASE_URL");
    const key = serviceKey();
    const keyHeaders: Record<string, string> = key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
    const rest = async (path: string, init: RequestInit = {}) => {
      const r = await fetchFn(`${url}/rest/v1/${path}`, { ...init, headers: { ...keyHeaders, "Content-Type": "application/json", ...(init.headers || {}) } });
      if (!r.ok) throw new Error(`rest ${r.status}: ${await r.text()}`);
      const t = await r.text();
      return t ? JSON.parse(t) : null;
    };

    const ures = await fetchFn(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: req.headers.get("Authorization") || "" } });
    if (!ures.ok) return json({ error: "unauthorized" }, 401);
    const me = (await ures.json()).id as string;
    const { game_id } = await req.json();
    if (typeof game_id !== "string" || !/^[0-9a-f-]{36}$/i.test(game_id)) return json({ error: "bad_request" }, 400);

    const g = (await rest(`games?id=eq.${game_id}&select=id,p1,p2,turn,status,lang,next_action,score1,score2,end_reason,gave_up_by`))[0];
    if (!g || (me !== g.p1 && me !== g.p2)) return json({ error: "not_found" }, 404);
    const opp = me === g.p1 ? g.p2 : g.p1;
    if (!opp) return json({ sent: 0 });

    let kind = "";
    if (g.status === "active" && g.turn === opp) {
      kind = g.next_action === "rerecord" ? "rerecord" : "guess";
      if (kind === "guess") {
        const moves = await rest(`moves?game_id=eq.${game_id}&select=id`);
        if (moves.length === 1) kind = "challenge";
      }
    } else if (g.status === "finished") {
      kind = g.end_reason === "gave_up" && g.gave_up_by === me ? "gaveup" : g.end_reason === "played" ? "finished" : "";
    }
    if (!kind) return json({ sent: 0 });

    const people = await rest(`profiles?id=in.(${me},${opp})&select=id,username`);
    const myName = people.find((p: any) => p.id === me)?.username ?? "?";
    const subs = await rest(`push_subs?user_id=eq.${opp}&select=endpoint,p256dh,auth,lang`);
    const oppScore = opp === g.p1 ? g.score1 : g.score2;
    const myScore = opp === g.p1 ? g.score2 : g.score1;
    const vapid = { publicKey: env("VAPID_PUBLIC_KEY"), privateKey: env("VAPID_PRIVATE_KEY"), subject: env("VAPID_SUBJECT") || "mailto:noreply@example.com" };

    let sent = 0;
    for (const s of subs) {
      const lang = TEXT[s.lang] ? s.lang : (TEXT[g.lang] ? g.lang : "de");
      const [title, body] = TEXT[lang][kind](myName, oppScore, myScore);
      try {
        const status = await sendPush(s, { title, body, game: game_id, tag: `game-${game_id}` }, vapid, fetchFn);
        if (status === 404 || status === 410) {
          await rest(`push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" });
        } else if (status < 300) sent++;
      } catch (_e) { /* einzelnes Gerät nicht erreichbar */ }
    }
    return json({ sent, kind });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

if ((globalThis as any).Deno?.serve) (globalThis as any).Deno.serve((req: Request) => handle(req));
