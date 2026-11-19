import fallbackSnapshotJson from "./fallback.generated.json?raw";
import { createClient } from "@supabase/supabase-js";
import { SITE_LOGO_URL } from "./branding";

/** Every language the site is published in, in switcher order. */
export const SITE_LANGS = ["en", "ar"] as const;
export type SiteLang = (typeof SITE_LANGS)[number];

export function isSiteLang(value: string): value is SiteLang {
  return (SITE_LANGS as readonly string[]).includes(value);
}

export type ContentSnapshot = {
  version: number;
  langs: Record<SiteLang, Record<string, string>>;
  images: Record<string, string>;
  contact: Record<string, string>;
  pages: Record<
    string,
    { titleKey: string; descriptionKey: string; keywordsKey: string | null; path: string }
  >;
};

/**
 * Built-in copy and imagery ship with the code; admin edits saved online
 * (site_content: texts per language, images, contact) are layered on top.
 */
const BASE: ContentSnapshot = JSON.parse(fallbackSnapshotJson);
BASE.images["doctor-logo"] = SITE_LOGO_URL;
BASE.images["dr-lama-logo"] = SITE_LOGO_URL;
BASE.images["transparent-pixel"] = SITE_LOGO_URL;
BASE.contact = {};

const TTL_MS = 10_000;
let cached: { at: number; snap: ContentSnapshot } | null = null;

async function readOverrides(): Promise<{ rows: { key: string; value: unknown; updated_at: string }[] } | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await sb.from("site_content").select("key, value, updated_at");
  if (error) return null;
  return { rows: (data ?? []) as never };
}

export async function getContentSnapshot(force = false): Promise<ContentSnapshot> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.snap;
  let snap: ContentSnapshot = BASE;
  try {
    const res = await readOverrides();
    if (res && res.rows.length) {
      const by = Object.fromEntries(res.rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
      const texts = (by["texts"] ?? {}) as Partial<Record<SiteLang, Record<string, string>>>;
      const images = (by["images"] ?? {}) as Record<string, string>;
      const latest = res.rows.reduce((m, r) => Math.max(m, Date.parse(r.updated_at) || 0), 0);
      snap = {
        ...BASE,
        version: latest || BASE.version,
        langs: Object.fromEntries(
          SITE_LANGS.map((l) => [l, { ...BASE.langs[l], ...(texts[l] ?? {}) }]),
        ) as ContentSnapshot["langs"],
        images: { ...BASE.images, ...images },
        contact: (by["contact"] ?? {}) as Record<string, string>,
      };
    }
  } catch {
    snap = BASE;
  }
  cached = { at: Date.now(), snap };
  return snap;
}

export function invalidateContentCache() {
  cached = null;
}
