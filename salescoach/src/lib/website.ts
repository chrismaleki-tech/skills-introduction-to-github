import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Fetches a public business website for the "Use a business website"
// scenario path and reduces it to plain text. Hardened against SSRF: only
// http(s), no credentials, hostnames resolved and checked against private /
// loopback / link-local / special ranges before every hop, redirects
// followed manually and re-validated, response size and time capped, HTML
// only. The returned text is reference data — callers must never execute it
// as instructions.

export const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_TEXT_CHARS = 7000;

export class WebsiteError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_URL" | "BLOCKED" | "UNREACHABLE" | "NOT_HTML" | "TOO_LITTLE",
  ) {
    super(message);
    this.name = "WebsiteError";
  }
}

export interface WebsiteSnapshot {
  finalUrl: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
}

export function normalizeUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new WebsiteError("Enter the business's website address.", "INVALID_URL");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new WebsiteError("That doesn't look like a valid web address.", "INVALID_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebsiteError("Only http and https websites are supported.", "INVALID_URL");
  }
  if (url.username || url.password) {
    throw new WebsiteError("Web addresses with embedded credentials are not allowed.", "INVALID_URL");
  }
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) {
    throw new WebsiteError("Enter a public website address, like acme.com.", "INVALID_URL");
  }
  url.hash = "";
  return url;
}

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet", ".arpa"];

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) || // IETF protocol assignments, 192.0.2.0/24 docs
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224 // multicast + reserved + broadcast
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isIP(v4) === 4 ? isPrivateIPv4(v4) : true;
  }
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("2001:db8")) return true; // documentation
  if (lower.startsWith("64:ff9b")) return true; // NAT64 — could map to private v4
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new WebsiteError("That address points at a private or internal network and can't be analyzed.", "BLOCKED");
  }
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new WebsiteError("That address points at a private or internal network and can't be analyzed.", "BLOCKED");
    }
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new WebsiteError("We couldn't find that website. Check the address and try again.", "UNREACHABLE");
  }
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new WebsiteError("That address points at a private or internal network and can't be analyzed.", "BLOCKED");
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, merged.length - offset));
    merged.set(slice, offset);
    offset += slice.length;
    if (offset >= merged.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchWebsite(rawUrl: string): Promise<WebsiteSnapshot> {
  let url = normalizeUrl(rawUrl);
  let html = "";
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ErotaScenarioBot/1.0; +https://www.erota.io)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en",
        },
      });
    } catch {
      clearTimeout(timer);
      throw new WebsiteError("We couldn't reach that website. It may be down, blocking automated visitors, or too slow.", "UNREACHABLE");
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new WebsiteError("The website redirected without a destination.", "UNREACHABLE");
      res.body?.cancel().catch(() => {});
      url = normalizeUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) {
      throw new WebsiteError(`The website responded with an error (HTTP ${res.status}).`, "UNREACHABLE");
    }
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("application/xhtml")) {
      throw new WebsiteError("That address isn't a web page we can read.", "NOT_HTML");
    }
    html = await readCapped(res);
    break;
  }
  if (!html) throw new WebsiteError("The website redirected too many times.", "UNREACHABLE");

  const snapshot = extractText(html, url.toString());
  if (snapshot.text.length < 120 && !snapshot.description) {
    throw new WebsiteError(
      "The website loaded but has very little readable text (it may be built entirely in JavaScript). Describe the business instead.",
      "TOO_LITTLE",
    );
  }
  return snapshot;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function extractText(html: string, finalUrl: string): WebsiteSnapshot {
  const noScripts = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ");

  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(noScripts)?.[1] ?? "");
  const metaDesc =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(noScripts)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(noScripts)?.[1] ??
    "";
  const ogDesc = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i.exec(noScripts)?.[1] ?? "";
  const description = clean(metaDesc || ogDesc);

  const headings: string[] = [];
  for (const m of noScripts.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
    const h = clean(m[1]);
    if (h && h.length < 160 && !headings.includes(h)) headings.push(h);
    if (headings.length >= 20) break;
  }

  // Body text: drop nav/footer/header chrome, then paragraphs and list items.
  const bodyOnly = noScripts.replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ");
  const blocks: string[] = [];
  for (const m of bodyOnly.matchAll(/<(p|li|h[1-6]|blockquote|td|dd|dt|figcaption)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = clean(m[2]);
    if (t.length >= 25 && !blocks.includes(t)) blocks.push(t);
  }
  let text = blocks.join("\n");
  if (text.length < 200) {
    // Fallback for div-soup pages: strip everything and keep the longest runs.
    text = clean(bodyOnly.replace(/<\/(div|section|article|br|tr)>/gi, "\n</$1>"))
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 25)
      .join("\n");
  }
  text = text.slice(0, MAX_TEXT_CHARS);

  return { finalUrl, title, description, headings, text };
}
