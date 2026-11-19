<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Vercel builds use Nitro's Vercel server preset; other builds retain the platform default, because public HTML requires request-time language rendering.
- Language-switch and internal navigation URLs carry an explicit language; cookie-selected responses are private to prevent cross-language CDN/browser cache reuse.
- Public site pages live in `src/site/*.html` (English source) and `src/lib/site-content/fallback.generated.json` (per-language text keyed by text hash); edit both together so every language stays in sync.
- Site images and videos are self-hosted under `public/img` and `public/reels`, so the site works on any host without Lovable asset URLs.
- Browser-saved admin edits use versioned storage keys; bump the version when content is replaced wholesale so stale edits never re-apply.

<!-- AGENT-MEMORY:BEGIN -->
- Public share metadata is finalized in `share-head.ts` after translation, using the request origin; rendered HTML caches include that origin so share images never leak another host's URL.
- The public site's visual design lives in `public/redesign.css`, linked last in every `src/site/*.html` head; restyle there instead of editing the older per-page CSS so one layer controls the look.
- Restructure page markup freely but keep every visible text string byte-identical, because translations are keyed by a hash of the English text.
- Home hero/intro and About hero/intro use the `lx-`, `ax-`, `ah-`, `ab2-` class prefixes (V5 block at the end of `public/redesign.css`); never reuse `hv-`, `hx-`, `hab-`, `abx-`, because dead legacy rules for those prefixes remain earlier in the file.
- Site-wide motion lives in `public/delight.css` + `public/js/delight.js`, injected by `render.server.ts` (skipped in edit mode); the script must stay idempotent per `<body>` and never alter text, because instant page swaps re-run it and translations are keyed by text. Keep it fast: heavy setup runs on idle, measures first then applies all DOM writes in one batch, reveals animate only opacity/translate, and looping effects pause via `.dl-idle` when their section is off screen.
- Every inner page uses the About-style `.ah` header and all pages share one `.ft` footer markup (V6 block in `public/redesign.css`); copy it verbatim between pages and reuse only strings that already have translations, so every language stays complete.
<!-- AGENT-MEMORY:END -->
- Admin data (site edits, appointment requests, patients, plans, appointments, invoices) lives in Lovable Cloud behind the `has_role(admin)` RLS check; the admin page signs in with Cloud auth, never a browser-stored password, because patient records must stay private.
- Admin logins are usernames mapped to emails (`src/lib/admin-auth.ts`); the first admin is created through first-time setup on `/admin` (only while no admin exists) and further admins are added by an admin in Account → Admin logins via server functions, because a shipped default password gets rejected as weak and is unsafe.
- `public/js/local-content.js` re-attaches its listeners on every run (no once-only global flag), because instant page swaps remove page-script listeners and re-run the file.
- Admin page edits are stored in `site_content` (`texts` per language, `images`, `contact`) and merged on the server in `src/lib/site-content/server.ts`, so every visitor sees them; uploaded photos go to the private `site-images` bucket and are served through `/api/public/img/*`.
