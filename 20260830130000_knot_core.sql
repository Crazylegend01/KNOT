-- Knot core data model. Apply with `supabase db push` or the Supabase SQL editor.
create type public.user_role as enum ('admin', 'user');
create type public.subscription_tier as enum ('free', 'weekly', 'paid_monthly');
create type public.plan_type as enum ('weekly', 'monthly');
create type public.queue_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, role public.user_role not null default 'user',
  subscription_tier public.subscription_tier not null default 'free',
  subscription_expires_at timestamptz, whatsapp_session_data jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(), plan_type public.plan_type not null unique,
  price_amount numeric(10,2) not null check (price_amount >= 0),
  currency text not null default 'NGN' check (char_length(currency) = 3),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.media_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cloudinary_url text not null, caption text,
  status public.queue_status not null default 'pending', scheduled_for timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index media_queue_user_schedule_idx on public.media_queue(user_id, scheduled_for);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger pricing_plans_set_updated_at before update on public.pricing_plans for each row execute procedure public.set_updated_at();
create trigger media_queue_set_updated_at before update on public.media_queue for each row execute procedure public.set_updated_at();

-- Auth users always start with the least-privilege role. Promote admins only from a trusted server/service role.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email) values (new.id, coalesce(new.email, '')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER avoids recursive RLS evaluation and exposes only a boolean role check.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- RLS identifies who can update a profile; this trigger prevents a signed-in
-- non-admin from changing their own role or subscription through the API.
create or replace function public.protect_profile_privileges() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() and (
    new.role is distinct from old.role
    or new.subscription_tier is distinct from old.subscription_tier
    or new.subscription_expires_at is distinct from old.subscription_expires_at
  ) then
    raise exception 'Only trusted billing/admin operations may change privileges';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_privileges before update on public.profiles for each row execute procedure public.protect_profile_privileges();

alter table public.profiles enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.media_queue enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
-- The trigger above protects role and billing fields for regular users.
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid() and not public.is_admin()) with check (id = auth.uid());
create policy "profiles_admin_full_access" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "pricing_plans_public_read" on public.pricing_plans for select to anon, authenticated using (true);
create policy "pricing_plans_admin_write" on public.pricing_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "media_queue_owner_or_admin_read" on public.media_queue for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "media_queue_owner_or_admin_insert" on public.media_queue for insert to authenticated with check (user_id = auth.uid() or public.is_admin());
create policy "media_queue_owner_or_admin_update" on public.media_queue for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "media_queue_owner_or_admin_delete" on public.media_queue for delete to authenticated using (user_id = auth.uid() or public.is_admin());

insert into public.pricing_plans (plan_type, price_amount, currency) values ('weekly', 2000.00, 'NGN'), ('monthly', 7000.00, 'NGN') on conflict (plan_type) do nothing;

-- Values are AES-256-GCM ciphertext created only by a trusted server route.
-- There are intentionally no browser-accessible policies on this table.
create table public.platform_settings (
  key text primary key,
  encrypted_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create trigger platform_settings_set_updated_at before update on public.platform_settings for each row execute procedure public.set_updated_at();
alter table public.platform_settings enable row level security;
