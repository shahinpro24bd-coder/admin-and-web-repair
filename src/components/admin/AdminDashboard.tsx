import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  LayoutGrid,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Stethoscope,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CONTACT,
  DEFAULT_FAQS,
  DEFAULT_SERVICES,
  newId,
  type ContactInfo,
  type Faq,
  type Service,
} from "@/lib/admin-store";
import { followUpDue, isOverdue, todayIso } from "@/lib/clinic";
import { emailToUsername, friendlyAuthError } from "@/lib/admin-auth";
import { addAdminUser, listAdminUsers, removeAdminUser } from "@/lib/admin.functions";
import { Appointments, Invoices, Patients, Reports, Requests, TreatmentPlans, useTable, type RequestRow } from "./Business";
import { btnAccent, btnDanger, btnOutline, Card, heading, input } from "./ui";

export type Tab =
  | "dashboard"
  | "requests"
  | "patients"
  | "plans"
  | "appointments"
  | "invoices"
  | "reports"
  | "contact"
  | "services"
  | "faqs"
  | "account";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "requests", label: "Appointment Requests", icon: CalendarCheck },
  { id: "patients", label: "Patients", icon: Users },
  { id: "plans", label: "Treatment Plans", icon: ClipboardList },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "contact", label: "Contact Info", icon: Building2 },
  { id: "services", label: "Treatments", icon: Stethoscope },
  { id: "faqs", label: "FAQs", icon: HelpCircle },
  { id: "account", label: "Account", icon: UserCog },
];

export const EDITABLE_PAGES = [
  { slug: "index", label: "Home", desc: "Hero, about the doctor, treatments, before & after, FAQ", icon: Home },
  { slug: "about", label: "About", desc: "Dr. Lama Ghassan's story, training and values", icon: Info },
  { slug: "service", label: "Treatments", desc: "All cosmetic dental treatments", icon: Stethoscope },
  { slug: "appoinment", label: "Appointment", desc: "Booking page and form texts", icon: CalendarCheck },
  { slug: "contact", label: "Contact", desc: "Contact details and form", icon: Mail },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Reads and writes one admin setting (contact, treatments, faqs) in the online site content. */
function useSetting<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    db.from("site_content")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data }: { data: { value: T } | null }) => {
        if (data?.value) setValue(data.value);
      });
  }, [key]);
  const save = useCallback(
    async (next: T) => {
      const { error } = await db
        .from("site_content")
        .upsert({ key, value: next, updated_at: new Date().toISOString() });
      if (error) toast.error(error.message);
      else toast.success("Saved");
    },
    [key],
  );
  return [value, setValue, save] as const;
}

export function AdminDashboard({
  onEditPage,
  onSignOut,
  email,
}: {
  onEditPage: (slug: string) => void;
  onSignOut: () => void;
  email: string;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [contact, setContact, saveContact] = useSetting<ContactInfo>("contact", DEFAULT_CONTACT);
  const [services, setServices, saveServices] = useSetting<Service[]>("treatments", DEFAULT_SERVICES);
  const [faqs, setFaqs, saveFaqs] = useSetting<Faq[]>("faqs", DEFAULT_FAQS);
  const req = useTable("appointment_requests");
  const requests = req.rows as RequestRow[];
  const treatmentNames = services.map((s) => s.name).filter(Boolean);
  const fullContact = { ...DEFAULT_CONTACT, ...contact };

  return (
    <div lang="en" dir="ltr" className="min-h-dvh bg-admin-canvas text-foreground">
      <header className="sticky top-0 z-10 bg-admin-bar text-admin-bar-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className={`${heading} text-2xl`}>
            Dr. Lama Ghassan <span className="text-admin-accent">Admin</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs opacity-70 sm:inline">{emailToUsername(email)}</span>
            <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-admin-bar-foreground px-2 py-1 text-sm">
              <ExternalLink className="size-4" /> View site
            </a>
            <button type="button" onClick={onSignOut} className="border border-admin-bar-foreground px-2 py-1 text-sm">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <nav className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const badge = t.id === "requests" ? requests.filter((r) => r.status === "new").length : 0;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={tab === t.id ? btnAccent : btnOutline}>
                <t.icon className="size-4" /> {t.label}
                {badge > 0 && <span className="bg-destructive px-1.5 text-xs text-destructive-foreground">{badge}</span>}
              </button>
            );
          })}
        </nav>

        {tab === "dashboard" && (
          <Overview requests={requests} onEditPage={onEditPage} setTab={setTab} />
        )}
        {tab === "requests" && <Requests requests={requests} reload={req.load} />}
        {tab === "patients" && <Patients />}
        {tab === "plans" && <TreatmentPlans treatments={treatmentNames} />}
        {tab === "appointments" && <Appointments treatments={treatmentNames} />}
        {tab === "invoices" && <Invoices contact={fullContact} />}
        {tab === "reports" && <Reports />}

        {tab === "contact" && (
          <Card className="max-w-3xl">
            <h2 className={`${heading} text-2xl`}>Contact info</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Phone, WhatsApp, email and social links update the buttons across the website. Clinic details also appear on printed invoices.
            </p>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveContact(fullContact);
              }}
            >
              {(
                [
                  ["doctor", "Doctor name"],
                  ["title", "Title"],
                  ["phone", "Phone"],
                  ["whatsapp", "WhatsApp number"],
                  ["email", "Email"],
                  ["hours", "Working hours"],
                  ["address", "Clinic address"],
                  ["instagram", "Instagram link"],
                  ["facebook", "Facebook link"],
                ] as [keyof ContactInfo, string][]
              ).map(([k, label]) => (
                <label key={k} className="text-xs font-medium text-muted-foreground">
                  {label}
                  <input
                    className={input}
                    value={fullContact[k] ?? ""}
                    onChange={(e) => setContact({ ...fullContact, [k]: e.target.value })}
                  />
                </label>
              ))}
              <div className="sm:col-span-2">
                <button type="submit" className={btnAccent}>Save contact info</button>
              </div>
            </form>
          </Card>
        )}

        {tab === "services" && (
          <ListEditor
            title="Treatments"
            hint="These treatments appear in the Treatment Plans and Appointments forms."
            items={services}
            fields={[
              ["name", "Treatment name", false],
              ["description", "Short description", true],
            ]}
            blank={() => ({ id: newId(), name: "", description: "" })}
            onChange={setServices}
            onSave={() => saveServices(services)}
          />
        )}

        {tab === "faqs" && (
          <ListEditor
            title="FAQs"
            hint="Common patient questions and the answers you give."
            items={faqs}
            fields={[
              ["question", "Question", false],
              ["answer", "Answer", true],
            ]}
            blank={() => ({ id: newId(), question: "", answer: "" })}
            onChange={setFaqs}
            onSave={() => saveFaqs(faqs)}
          />
        )}

        {tab === "account" && <AccountForm email={email} />}
      </main>
    </div>
  );
}

function Overview({
  requests,
  onEditPage,
  setTab,
}: {
  requests: RequestRow[];
  onEditPage: (slug: string) => void;
  setTab: (t: Tab) => void;
}) {
  const appts = useTable("appointments", "scheduled_date").rows;
  const invoices = useTable("invoices", "issue_date").rows;
  const plans = useTable("treatment_plans").rows;
  const today = todayIso();
  const weekAgo = Date.now() - 7 * 864e5;
  const stats: { n: number; label: string; tab: Tab }[] = [
    { n: requests.filter((r) => r.status === "new").length, label: "New appointment requests", tab: "requests" },
    { n: requests.filter((r) => Date.parse(r.created_at) > weekAgo).length, label: "Requests this week", tab: "requests" },
    { n: requests.filter((r) => followUpDue(r)).length, label: "Follow-ups due", tab: "requests" },
    {
      n: appts.filter((a) => a.scheduled_date === today && !["cancelled", "completed"].includes(a.status)).length,
      label: "Appointments today",
      tab: "appointments",
    },
    { n: plans.filter((p) => p.status === "active").length, label: "Active treatment plans", tab: "plans" },
    { n: invoices.filter((i) => isOverdue(i)).length, label: "Overdue invoices", tab: "invoices" },
  ];
  const upcoming = appts
    .filter((a) => a.scheduled_date >= today && ["scheduled", "confirmed"].includes(a.status))
    .sort((a, b) => `${a.scheduled_date}${a.scheduled_time}`.localeCompare(`${b.scheduled_date}${b.scheduled_time}`))
    .slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <button key={s.label} type="button" onClick={() => setTab(s.tab)} className="text-left">
            <Card className="h-full transition-transform hover:-translate-y-0.5">
              <div className="text-3xl font-semibold">{s.n}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </Card>
          </button>
        ))}
      </div>

      <h2 className={`${heading} mt-8 text-2xl`}>Which page do you want to edit?</h2>
      <p className="mb-4 text-muted-foreground">Open a page to change its texts and photos directly on the page. Saved changes go live for every visitor.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {EDITABLE_PAGES.map((p) => (
          <Card key={p.slug} className="flex flex-col">
            <span className="mb-3 flex size-11 items-center justify-center bg-admin-accent-soft text-admin-accent">
              <p.icon className="size-5" />
            </span>
            <h3 className={`${heading} text-xl`}>{p.label}</h3>
            <p className="mb-3 flex-1 text-sm text-muted-foreground">{p.desc}</p>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => onEditPage(p.slug)} className="inline-flex items-center gap-1.5 text-admin-accent">
                <Pencil className="size-4" /> Edit page
              </button>
              <a href={`/${p.slug}.html`} target="_blank" rel="noreferrer" className="text-sm text-admin-accent/80">
                View
              </a>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <ListCard title="Latest appointment requests" onAll={() => setTab("requests")} empty="No requests yet. They appear here when patients send the appointment form.">
          {requests.slice(0, 5).map((r) => (
            <li key={r.id} className="flex justify-between gap-2 border-b border-border py-2 text-sm">
              <span>
                <b className={r.status === "new" ? "" : "font-normal"}>{r.name}</b> · {r.phone}
              </span>
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
            </li>
          ))}
        </ListCard>
        <ListCard title="Upcoming appointments" onAll={() => setTab("appointments")} empty="No upcoming appointments.">
          {upcoming.map((a) => (
            <li key={a.id} className="flex justify-between gap-2 border-b border-border py-2 text-sm">
              <span>
                <b>{a.patient_name || a.title}</b> · {a.treatment || a.title}
              </span>
              <span className="text-muted-foreground">
                {a.scheduled_date} {a.scheduled_time?.slice(0, 5)}
              </span>
            </li>
          ))}
        </ListCard>
        <Card>
          <h3 className={`${heading} mb-3 text-xl`}>Quick actions</h3>
          <div className="grid gap-2">
            <button type="button" className={btnAccent} onClick={() => onEditPage("index")}>
              <Pencil className="size-4" /> Edit home page
            </button>
            <button type="button" className={btnOutline} onClick={() => setTab("appointments")}>
              <CalendarDays className="size-4" /> Book an appointment
            </button>
            <button type="button" className={btnOutline} onClick={() => setTab("invoices")}>
              <Receipt className="size-4" /> Create an invoice
            </button>
            <button type="button" className={btnOutline} onClick={() => setTab("contact")}>
              <Phone className="size-4" /> Update contact info
            </button>
            <button type="button" className={btnOutline} onClick={() => setTab("account")}>
              <KeyRound className="size-4" /> Change password
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}

function ListCard({ title, onAll, empty, children }: { title: string; onAll: () => void; empty: string; children: ReactNode[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={`${heading} text-xl`}>{title}</h3>
        <button type="button" onClick={onAll} className="text-sm text-admin-accent">
          See all
        </button>
      </div>
      {children.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul>{children}</ul>}
    </Card>
  );
}

function ListEditor<T extends { id: string }>({
  title,
  hint,
  items,
  fields,
  blank,
  onChange,
  onSave,
}: {
  title: string;
  hint: string;
  items: T[];
  fields: [keyof T & string, string, boolean][];
  blank: () => T;
  onChange: (v: T[]) => void;
  onSave: () => void;
}) {
  return (
    <Card className="max-w-3xl">
      <div className="mb-1 flex items-center justify-between">
        <h2 className={`${heading} text-2xl`}>{title}</h2>
        <button type="button" className={btnOutline} onClick={() => onChange([...items, blank()])}>
          <Plus className="size-4" /> Add
        </button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{hint}</p>
      <div className="grid gap-3">
        {items.map((item, idx) => (
          <div key={item.id} className="border border-border p-3">
            {fields.map(([k, label, multi]) => {
              const value = String(item[k] ?? "");
              const set = (v: string) => onChange(items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));
              return (
                <label key={k} className="mb-2 block text-xs font-medium text-muted-foreground">
                  {label}
                  {multi ? (
                    <textarea className={input} rows={2} value={value} onChange={(e) => set(e.target.value)} />
                  ) : (
                    <input className={input} value={value} onChange={(e) => set(e.target.value)} />
                  )}
                </label>
              );
            })}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-destructive"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="size-4" /> Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={`${btnAccent} mt-4`} onClick={onSave}>
        Save {title.toLowerCase()}
      </button>
    </Card>
  );
}

export function PasswordForm({ email, onDone }: { email: string; onDone?: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg("");
        if (next.length < 8) return setMsg("New password must be at least 8 characters.");
        if (next !== confirm) return setMsg("The two new passwords do not match.");
        if (next === current) return setMsg("The new password must be different from the current one.");
        setBusy(true);
        try {
          const check = await supabase.auth.signInWithPassword({ email, password: current });
          if (check.error) return setMsg("Current password is wrong.");
          const { error } = await supabase.auth.updateUser({ password: next, current_password: current });
          if (error) return setMsg(friendlyAuthError(error.message));
          setCurrent("");
          setNext("");
          setConfirm("");
          toast.success("Password changed");
          onDone?.();
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-medium text-muted-foreground">
        Current password
        <input type="password" className={input} value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        New password
        <input type="password" className={input} value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        Repeat new password
        <input type="password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </label>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      <button type="submit" className={btnAccent} disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

type AdminLogin = { id: string; username: string; lastSignIn: string | null; isYou: boolean };

function AdminLogins() {
  const [list, setList] = useState<AdminLogin[] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setList(await listAdminUsers());
    } catch (e) {
      setMsg((e as Error).message);
      setList([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="max-w-xl">
      <h2 className={`${heading} text-2xl`}>Admin logins</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Everyone listed here can sign in to this admin panel with their own username and password.
      </p>
      <ul className="mb-5 divide-y divide-border border border-border">
        {list === null && <li className="p-3 text-sm text-muted-foreground">Loading…</li>}
        {list?.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <span>
              <b>{u.username}</b> {u.isYou && <span className="text-muted-foreground">(you)</span>}
              <small className="block text-muted-foreground">
                {u.lastSignIn ? `Last sign-in ${new Date(u.lastSignIn).toLocaleString("en-GB")}` : "Never signed in"}
              </small>
            </span>
            {!u.isYou && (
              <button
                type="button"
                className={btnDanger}
                onClick={async () => {
                  if (!window.confirm(`Remove the login "${u.username}"?`)) return;
                  const res = await removeAdminUser({ data: { userId: u.id } });
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Login removed");
                    void load();
                  }
                }}
              >
                <Trash2 className="size-3.5" /> Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          if (username.trim().length < 2) return setMsg("Username must be at least 2 characters.");
          if (password.length < 8) return setMsg("Password must be at least 8 characters.");
          setBusy(true);
          try {
            const res = await addAdminUser({ data: { username: username.trim(), password } });
            if (!res.ok) return setMsg(res.error);
            toast.success(`Login "${username.trim()}" added`);
            setUsername("");
            setPassword("");
            void load();
          } catch (err) {
            setMsg((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="text-xs font-medium text-muted-foreground">
          New username
          <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Password
          <input type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        {msg && <p className="text-sm text-destructive sm:col-span-2">{msg}</p>}
        <div className="sm:col-span-2">
          <button type="submit" className={btnAccent} disabled={busy}>
            <Plus className="size-4" /> {busy ? "Adding…" : "Add admin login"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function AccountForm({ email }: { email: string }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,36rem)]">
      <Card>
        <h2 className={`${heading} text-2xl`}>Your password</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Signed in as <b>{emailToUsername(email)}</b>
        </p>
        <PasswordForm email={email} />
      </Card>
      <AdminLogins />
    </div>
  );
}
