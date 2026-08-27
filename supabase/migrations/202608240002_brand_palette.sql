-- Working colour palette for each school. Role colours stay in sync with the first three swatches.

alter table public.brand_profiles
  add column if not exists palette text[] not null default '{}';

update public.brand_profiles
set palette = array[primary_color, secondary_color, accent_color]
where coalesce(cardinality(palette), 0) = 0;
