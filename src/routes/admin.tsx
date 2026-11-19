import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ImagePlus, LogOut, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { createFirstAdmin, getAdminSetupState } from "@/lib/admin.functions";
import { friendlyAuthError, usernameToEmail } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

const PAGES = [
  { slug: "index", label: "Home" },
  { slug: "about", label: "About" },
  { slug: "service", label: "Treatments" },
  { slug: "appoinment", label: "Appointment" },
  { slug: "contact", label: "Contact" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db.from("site_content").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

async function writeSetting(key: string, value: unknown) {
  const { error } = await db
    .from("site_content")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Teko:wght@500;600&display=swap" }],
    meta: [
      { title: "Admin Panel | Dr. Lama Ghassan" },
      { name: "description", content: "Manage Dr. Lama Ghassan's website, patients, treatment plans, appointments and invoices." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin Panel | Dr. Lama Ghassan" },
      { property: "og:description", content: "Manage Dr. Lama Ghassan's website, patients, treatment plans, appointments and invoices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Status = { tone: "idle" | "busy" | "ok" | "error"; message: string };

function AdminPage() {
  const [state, setState] = useState<"checking" | "out" | "in">("checking");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const check = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      setState("out");
      return;
    }
    const { data: isAdmin, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (error || !isAdmin) {
      await supabase.auth.signOut();
      setNotice(
        error
          ? "Could not check your access. Please try again."
          : "This account does not have admin access. Ask the main admin to add you under Account → Admin logins.",
      );
      setState("out");
      return;
    }
    setNotice("");
    setEmail(user.email ?? "");
    setState("in");
  }, []);

  useEffect(() => {
    void check();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setState("out");
        setEditing(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [check]);

  const signOut = async () => {
    setNotice("");
    await supabase.auth.signOut();
  };

  let body;
  if (state === "checking") body = null;
  else if (state === "out") body = <LoginScreen onSuccess={check} notice={notice} />;
  else if (editing)
    body = <Editor initialPage={editing} onBack={() => setEditing(null)} onSignOut={signOut} />;
  else body = <AdminDashboard onEditPage={setEditing} onSignOut={signOut} email={email} />;

  return (
    <>
      {body}
      <Toaster position="bottom-right" />
    </>
  );
}

function LoginScreen({ onSuccess, notice }: { onSuccess: () => void | Promise<void>; notice: string }) {
  const [setup, setSetup] = useState<boolean | null>(null);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminSetupState()
      .then((r) => setSetup(r.needsSetup))
      .catch(() => setSetup(false));
  }, []);

  useEffect(() => {
    if (setup) setUser((u) => u || "admin");
  }, [setup]);

  const signIn = async (username: string, pw: string) => {
    const { error: err } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password: pw });
    if (err) {
      setError(friendlyAuthError(err.message));
      return false;
    }
    await onSuccess();
    return true;
  };

  return (
    <div lang="en" dir="ltr" className="flex min-h-dvh items-center justify-center bg-muted px-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (!user.trim() || !password) return;
          if (setup) {
            if (password.length < 8) return setError("Password must be at least 8 characters.");
            if (password !== confirm) return setError("The two passwords do not match.");
          }
          setBusy(true);
          try {
            if (setup) {
              const res = await createFirstAdmin({ data: { username: user.trim(), password } });
              if (!res.ok) {
                setError(res.error);
                if (/already exists/i.test(res.error)) setSetup(false);
                return;
              }
              toast.success("Admin account created");
            }
            await signIn(user, password);
          } catch (err) {
            setError(friendlyAuthError((err as Error).message || "Something went wrong. Please try again."));
          } finally {
            setBusy(false);
          }
        }}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-card-foreground">
          {setup ? "Create your admin account" : "Dr. Lama Ghassan Admin"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {setup
            ? "First-time setup: choose the username and a private password you will use to sign in."
            : "Sign in to manage the website and the clinic."}
        </p>

        {notice && !error ? <p className="mt-3 text-xs text-destructive">{notice}</p> : null}

        <label className="mt-5 block text-xs font-medium text-muted-foreground">
          Username
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={setup ? "new-password" : "current-password"}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        {setup ? (
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            Repeat password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        ) : null}

        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

        <Button type="submit" className="mt-5 w-full" disabled={busy || setup === null}>
          {busy ? (setup ? "Creating…" : "Signing in…") : setup ? "Create account & sign in" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

function Editor({ onSignOut, onBack, initialPage }: { onSignOut: () => void | Promise<void>; onBack: () => void; initialPage: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState<string>(initialPage);
  const [lang, setLang] = useState<string>("en");
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ tone: "idle", message: "" });
  const [images, setImages] = useState<{ slot: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<string | null>(null);

  const dirtyCount = useMemo(() => Object.keys(dirty).length, [dirty]);
  const frameSrc = `/${page}.html?edit=1&lang=${lang}`;

  const saveImage = useCallback(async (slot: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus({ tone: "error", message: "Please choose an image file." });
      return;
    }
    if (file.size > 5_000_000) {
      setStatus({ tone: "error", message: "Image is too large (maximum 5 MB)." });
      return;
    }
    setStatus({ tone: "busy", message: "Uploading image…" });
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
      const safeSlot = slot.replace(/[^\w-]/g, "-").slice(0, 80);
      const name = `${safeSlot}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("site-images").upload(name, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      const url = `/api/public/img/${name}`;
      const images = await readSetting<Record<string, string>>("images", {});
      images[slot] = url;
      await writeSetting("images", images);
      frameRef.current?.contentWindow?.postMessage(
        { source: "cms-admin", type: "image-saved", slot, url },
        "*",
      );
      setStatus({ tone: "ok", message: "Image saved — live on the website." });
    } catch (e) {
      setStatus({ tone: "error", message: `Could not save the image. ${(e as Error).message}` });
    }
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.source !== "cms-editor") return;
      if (data.type === "lang-changed" && typeof data.lang === "string") {
        setLang(data.lang);
        return;
      }
      if (data.type === "images" && Array.isArray(data.images)) {
        setImages(data.images);
        return;
      }
      if (data.type === "text") {
        setDirty((prev) => ({ ...prev, [data.key]: data.value }));
      } else if (data.type === "image" && data.file instanceof File) {
        void saveImage(data.slot, data.file);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [saveImage]);

  async function handleSave() {
    if (!dirtyCount) return;
    setStatus({ tone: "busy", message: "Saving…" });
    try {
      const texts = await readSetting<Record<string, Record<string, string>>>("texts", {});
      texts[lang] = { ...(texts[lang] ?? {}), ...dirty };
      await writeSetting("texts", texts);
      setDirty({});
      setStatus({ tone: "ok", message: "Saved — live on the website." });
      toast.success("Page saved");
    } catch (e) {
      setStatus({ tone: "error", message: `Could not save changes. ${(e as Error).message}` });
    }
  }

  function handleReset() {
    if (!dirtyCount) return;
    if (!window.confirm("Discard the changes you have not saved yet?")) return;
    setDirty({});
    setStatus({ tone: "ok", message: "Unsaved changes discarded." });
    frameRef.current?.contentWindow?.location.reload();
  }

  function switchTo(next: { page?: string; lang?: string }) {
    if (dirtyCount && !window.confirm("You have unsaved changes. Continue without saving?")) return;
    setDirty({});
    if (next.page) setPage(next.page);
    if (next.lang) setLang(next.lang);
  }

  return (
    <div lang="en" dir="ltr" className="flex h-dvh min-h-0 flex-col bg-muted">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-3 py-3 sm:px-4 lg:flex lg:flex-wrap">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            ← Dashboard
          </Button>
          <select
            aria-label="Page to edit"
            value={page}
            onChange={(e) => switchTo({ page: e.target.value })}
            className="min-w-0 max-w-48 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {PAGES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 overflow-hidden rounded-md border border-input">
          {(
            [
              ["en", "English"],
              ["ar", "العربية"],
            ] as const
          ).map(([code, label]) => (
            <Button
              key={code}
              type="button"
              variant={lang === code ? "default" : "ghost"}
              size="sm"
              onClick={() => switchTo({ lang: code })}
              className="rounded-none px-2.5"
            >
              {label}
            </Button>
          ))}
        </div>

        <span className="col-span-2 min-w-0 text-xs text-muted-foreground lg:col-auto">
          Dr. Lama Ghassan · {dirtyCount ? "Unsaved changes" : "Website editor"}
        </span>

        <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-2 lg:col-auto lg:ml-auto">
          {status.message ? (
            <span
              className={
                "text-xs " +
                (status.tone === "error" ? "text-destructive" : "text-muted-foreground")
              }
            >
              {status.message}
            </span>
          ) : null}
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirtyCount || status.tone === "busy"}
            size="sm"
          >
            <Save aria-hidden="true" />
            Save{dirtyCount ? ` (${dirtyCount})` : ""}
          </Button>
          <Button type="button" onClick={handleReset} variant="ghost" size="sm" disabled={!dirtyCount}>
            <RotateCcw aria-hidden="true" />
            Discard
          </Button>
          <a
            href={`/${page}.html`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            View site
          </a>
          <Button
            type="button"
            onClick={onSignOut}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <iframe
          ref={frameRef}
          key={frameSrc}
          src={frameSrc}
          title="Dr. Lama Ghassan website preview"
          className="min-h-0 min-w-0 flex-1 border-0 bg-background"
        />
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-border bg-card p-3 md:block">
          <h2 className="mb-2 text-sm font-semibold text-card-foreground">
            Images ({images.length})
          </h2>
          <ul className="space-y-3">
            {images.map((img) => (
              <li key={img.slot} className="rounded-md border border-border p-2">
                <button
                  type="button"
                  onClick={() =>
                    frameRef.current?.contentWindow?.postMessage(
                      { source: "cms-admin", type: "scroll-to", slot: img.slot },
                      "*",
                    )
                  }
                  className="block w-full"
                  title="Show on page"
                >
                  <img src={img.url} alt={img.slot} className="h-24 w-full rounded object-cover" />
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  disabled={status.tone === "busy"}
                  onClick={() => {
                    pendingSlot.current = img.slot;
                    fileRef.current?.click();
                  }}
                >
                  <ImagePlus aria-hidden="true" />
                  Replace image
                </Button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && pendingSlot.current) void saveImage(pendingSlot.current, file);
        }}
      />
    </div>
  );
}
