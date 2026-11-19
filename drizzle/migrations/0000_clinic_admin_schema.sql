create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
grant all on public.site_content to service_role;
alter table public.site_content enable row level security;
create policy "Anyone reads site content" on public.site_content for select to anon, authenticated using (true);
create policy "Admins manage site content" on public.site_content for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 3 and 40),
  email text check (email is null or char_length(email) <= 200),
  preferred_date text check (preferred_date is null or char_length(preferred_date) <= 60),
  treatment text check (treatment is null or char_length(treatment) <= 200),
  message text check (message is null or char_length(message) <= 3000),
  page text check (page is null or char_length(page) <= 200),
  status text not null default 'new',
  notes text,
  follow_up_date date,
  created_at timestamptz not null default now()
);
grant insert on public.appointment_requests to anon;
grant select, insert, update, delete on public.appointment_requests to authenticated;
grant all on public.appointment_requests to service_role;
alter table public.appointment_requests enable row level security;
create policy "Visitors send appointment requests" on public.appointment_requests for insert to anon, authenticated
  with check (status = 'new' and notes is null and follow_up_date is null);
create policy "Admins manage appointment requests" on public.appointment_requests for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  date_of_birth date,
  gender text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  treatment text,
  status text not null default 'active',
  start_date date,
  end_date date,
  visits_planned integer,
  visits_done integer,
  next_visit date,
  amount numeric,
  notes text,
  created_at timestamptz not null default now()
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  patient_name text,
  phone text,
  treatment text,
  dentist text default 'Dr. Lama Ghassan',
  status text not null default 'scheduled',
  priority text not null default 'normal',
  scheduled_date date,
  scheduled_time text,
  notes text,
  created_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null,
  patient_name text not null,
  amount numeric not null default 0,
  vat_percent numeric not null default 5,
  status text not null default 'unpaid',
  issue_date date not null default current_date,
  due_date date,
  paid_date date,
  description text,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.patients, public.treatment_plans, public.appointments, public.invoices to authenticated;
grant all on public.patients, public.treatment_plans, public.appointments, public.invoices to service_role;
alter table public.patients enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.appointments enable row level security;
alter table public.invoices enable row level security;
create policy "Admins manage patients" on public.patients for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage treatment plans" on public.treatment_plans for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage appointments" on public.appointments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage invoices" on public.invoices for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins read site images" on storage.objects for select to authenticated
  using (bucket_id = 'site-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins upload site images" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update site images" on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete site images" on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and public.has_role(auth.uid(), 'admin'));