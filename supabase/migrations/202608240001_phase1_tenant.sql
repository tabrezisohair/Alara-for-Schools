-- Phase 1: tenant foundation only.
-- Isolates organizations, profiles, memberships, school_profiles, brand_profiles.
-- Does not migrate jobs, assets, calendar, campaigns, notifications, or email tokens.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null default 'school',
  slug text not null unique,
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now(),
  constraint organizations_industry_check check (industry in ('school'))
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  roles text[] not null default array['creator']::text[],
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  constraint membership_roles_valid check (
    roles <@ array['creator', 'approver', 'admin']::text[]
    and cardinality(roles) >= 1
  )
);

create table public.school_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  levels text,
  campuses text[] not null default '{}',
  tagline text,
  mission text,
  phone text,
  website text,
  address text,
  admissions_line text,
  socials jsonb not null default '{}',
  tone jsonb not null default '{}',
  event_types text[] not null default '{}',
  extra_spellings jsonb not null default '{}',
  caption_language_default text not null default 'en',
  poster_language_default text not null default 'en',
  whatsapp_bilingual boolean not null default false
);

create table public.brand_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  logo_path text,
  logo_accepted boolean not null default false,
  primary_color text not null default '#0D2C54',
  secondary_color text not null default '#E8B923',
  accent_color text not null default '#F7F1DE',
  text_on_primary text not null default '#FFFFFF',
  heading_font text not null default 'Georgia, serif',
  body_font text not null default 'system-ui, sans-serif',
  detected_note text
);

create index organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create or replace function public.is_org_member(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = oid
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(oid uuid, r text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = oid
      and user_id = auth.uid()
      and roles @> array[r]::text[]
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.school_profiles enable row level security;
alter table public.brand_profiles enable row level security;

create policy organizations_select_member
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

create policy organizations_update_admin
  on public.organizations for update to authenticated
  using (public.has_org_role(id, 'admin'))
  with check (public.has_org_role(id, 'admin'));

create policy profiles_select_self
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_select_org_colleagues
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships mine
      join public.organization_memberships theirs
        on mine.organization_id = theirs.organization_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy memberships_select_org
  on public.organization_memberships for select to authenticated
  using (public.is_org_member(organization_id));

create policy school_profiles_select_member
  on public.school_profiles for select to authenticated
  using (public.is_org_member(organization_id));

create policy school_profiles_update_admin
  on public.school_profiles for update to authenticated
  using (public.has_org_role(organization_id, 'admin'))
  with check (public.has_org_role(organization_id, 'admin'));

create policy brand_profiles_select_member
  on public.brand_profiles for select to authenticated
  using (public.is_org_member(organization_id));

create policy brand_profiles_update_admin
  on public.brand_profiles for update to authenticated
  using (public.has_org_role(organization_id, 'admin'))
  with check (public.has_org_role(organization_id, 'admin'));

insert into storage.buckets (id, name, public)
values ('organization-files', 'organization-files', false)
on conflict (id) do nothing;

create or replace function public.storage_org_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (string_to_array(object_name, '/'))[1]::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.storage_org_id(text) to authenticated;

create policy organization_files_select_member
  on storage.objects for select to authenticated
  using (
    bucket_id = 'organization-files'
    and public.is_org_member(public.storage_org_id(name))
  );

create policy organization_files_insert_admin
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-files'
    and public.has_org_role(public.storage_org_id(name), 'admin')
  );

create policy organization_files_update_admin
  on storage.objects for update to authenticated
  using (
    bucket_id = 'organization-files'
    and public.has_org_role(public.storage_org_id(name), 'admin')
  );

create policy organization_files_delete_admin
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'organization-files'
    and public.has_org_role(public.storage_org_id(name), 'admin')
  );
