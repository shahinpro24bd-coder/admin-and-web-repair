import { getContentSnapshot, isSiteLang, SITE_LANGS, type SiteLang } from "./server";
import { PAGE_SOURCE } from "./pages.server";
import { renderPage } from "./transform";
import { brandShareHead } from "./share-head";

/**
 * Builds one public page: every string and image comes from the database, the
 * markup itself is untouched so the design stays identical to the original.
 * Each supported language is rendered server-side via ?lang=xx.
 */
export async function renderSitePage(request: Request, slug: string): Promise<Response> {
  if (slug === "gallery") {
    return Response.redirect(new URL("/service.html", request.url), 301);
  }
  const source = PAGE_SOURCE[slug];
  if (!source) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const editMode = url.searchParams.get("edit") === "1";
  const langParam = url.searchParams.get("lang") || "";
  const cookieLang = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)site_lang=(en|ar)(?:;|$)/)?.[1];
  const lang: SiteLang = isSiteLang(langParam)
    ? langParam
    : cookieLang && isSiteLang(cookieLang)
      ? cookieLang
      : "ar";

  const snapshot = await getContentSnapshot(editMode);
  const texts = snapshot.langs[lang];

  // Fully rendered pages are memoised per slug+language+content version, so a
  // repeat request skips the HTML parse/transform entirely.
  const cacheKey = `${url.origin}|${slug}|${lang}|${snapshot.version}|${url.pathname}`;
  if (!editMode) {
    const cached = RENDER_CACHE.get(cacheKey);
    if (cached) return htmlResponse(cached, snapshot.version, false, !isSiteLang(langParam));
  }

  const bootstrap =
    `<script>window.__SITE_LANG__=${JSON.stringify(lang)};` +
    `window.__SITE_LANGS__=${JSON.stringify([...SITE_LANGS])};` +
    `window.__SITE_EDIT__=${editMode ? "true" : "false"};` +
    `window.__SITE_CONTACT__=${JSON.stringify(snapshot.contact ?? {}).replace(/</g, "\\u003c")};</script>` +
    `<script src="/js/local-content.js" defer></script>` +
    (editMode ? "" : `<script src="/js/delight.js" defer></script>`);


  let html = renderPage(source, {
    texts,
    images: snapshot.images,
    editMode,
    lang,
    bodyScripts: bootstrap,
  });

  // SEO: self-referential hreflang alternates for every published language.
  const links: string[] = [];
  {
    links.push(
      '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' +
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=El+Messiri:wght@500;600;700&display=swap" />',
    );
  }
  // Playful motion layer, loaded after every page stylesheet.
  links.push('<link rel="stylesheet" href="/delight.css" />');
  links.push(...SITE_LANGS.map((code) => {
    const href =
      code === "ar" ? url.origin + url.pathname : `${url.origin}${url.pathname}?lang=${code}`;
    return `<link rel="alternate" hreflang="${code}" href="${href}" />`;
  }));
  links.push(`<link rel="alternate" hreflang="x-default" href="${url.origin}${url.pathname}" />`);
  // Instant page switching must start before page scripts run.
  if (!editMode) html = html.replace(/<head([^>]*)>/i, '<head$1><script src="/js/speed.js"></script>');
  const headIndex = html.lastIndexOf("</head>");
  if (headIndex !== -1) html = html.slice(0, headIndex) + links.join("") + html.slice(headIndex);
  html = brandShareHead(html, url.origin);

  if (!editMode) {
    if (RENDER_CACHE.size > 64) RENDER_CACHE.clear();
    RENDER_CACHE.set(cacheKey, html);
  }

  return htmlResponse(html, snapshot.version, editMode, !isSiteLang(langParam));
}

/** slug|lang|version|path -> fully rendered HTML */
const RENDER_CACHE = new Map<string, string>();

function htmlResponse(html: string, version: number | string, editMode: boolean, usesCookie: boolean): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": editMode
        ? "no-store"
        : usesCookie
          ? "private, no-cache"
          : "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
      "Vary": "Cookie",
      "X-Content-Version": String(version),
    },
  });
}
