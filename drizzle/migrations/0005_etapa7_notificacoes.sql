create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  titulo text not null,
  mensagem text,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, update on public.notificacoes to authenticated;
grant all on public.notificacoes to service_role;

alter table public.notificacoes enable row level security;

create policy "notif select own" on public.notificacoes for select to authenticated using (user_id = auth.uid());
create policy "notif update own" on public.notificacoes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.trg_notify_falta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare nome text;
begin
  if new.status = 'falta' then
    select c.nome into nome from public.colaboradores c where c.id = new.colaborador_id;
    insert into public.notificacoes (user_id, titulo, mensagem, link)
      select ur.user_id, 'Falta registrada',
        coalesce(nome,'Colaborador') || ' registrou falta em ' || to_char(new.data, 'DD/MM/YYYY'), '/presenca'
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id and p.status = 'ativo'
      where ur.role in ('admin','gestor','rh');
  end if;
  return new;
end $$;

create trigger notify_falta after insert on public.presencas for each row execute function public.trg_notify_falta();

create or replace function public.trg_notify_ferias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare nome text; uid uuid;
begin
  select c.nome, c.user_id into nome, uid from public.colaboradores c where c.id = new.colaborador_id;
  if tg_op = 'INSERT' and new.status = 'solicitada' then
    insert into public.notificacoes (user_id, titulo, mensagem, link)
      select ur.user_id, 'Pedido de férias',
        coalesce(nome,'Colaborador') || ' solicitou férias de ' || to_char(new.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(new.data_fim,'DD/MM/YYYY'), '/ferias'
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id and p.status = 'ativo'
      where ur.role in ('admin','gestor','rh');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('aprovada','recusada') and uid is not null then
    insert into public.notificacoes (user_id, titulo, mensagem, link)
      values (uid, 'Férias ' || case when new.status = 'aprovada' then 'aprovadas' else 'recusadas' end,
        'Período de ' || to_char(new.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(new.data_fim,'DD/MM/YYYY'), '/ferias');
  end if;
  return new;
end $$;

create trigger notify_ferias_ins after insert on public.ferias for each row execute function public.trg_notify_ferias();
create trigger notify_ferias_upd after update on public.ferias for each row execute function public.trg_notify_ferias();