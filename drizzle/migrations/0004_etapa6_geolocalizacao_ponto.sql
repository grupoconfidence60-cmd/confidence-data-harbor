alter table public.postos
  add column latitude double precision,
  add column longitude double precision,
  add column raio_metros integer not null default 150;

alter table public.presencas
  add column latitude double precision,
  add column longitude double precision,
  add column distancia_metros double precision;

create or replace function public.distancia_metros(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ))
$$;

drop policy "presencas colab insert own" on public.presencas;
create policy "presencas colab insert own" on public.presencas for insert to authenticated with check (
  public.has_role(auth.uid(),'colaborador')
  and data = current_date
  and exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid() and c.arquivado = false)
  and (
    not exists (select 1 from public.postos p where p.id = posto_id and p.latitude is not null and p.longitude is not null)
    or (
      latitude is not null and longitude is not null
      and exists (select 1 from public.postos p where p.id = posto_id and p.latitude is not null
        and public.distancia_metros(latitude, longitude, p.latitude, p.longitude) <= p.raio_metros)
    )
  )
);

drop policy "presencas colab update own" on public.presencas;
create policy "presencas colab update own" on public.presencas for update to authenticated using (
  public.has_role(auth.uid(),'colaborador')
  and data = current_date
  and exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
) with check (
  data = current_date
  and exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
  and (
    not exists (select 1 from public.postos p where p.id = posto_id and p.latitude is not null and p.longitude is not null)
    or (
      latitude is not null and longitude is not null
      and exists (select 1 from public.postos p where p.id = posto_id and p.latitude is not null
        and public.distancia_metros(latitude, longitude, p.latitude, p.longitude) <= p.raio_metros)
    )
  )
);