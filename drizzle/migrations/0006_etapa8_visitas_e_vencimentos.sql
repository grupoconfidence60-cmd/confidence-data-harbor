alter table public.documentos add column data_vencimento date;

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  posto_id uuid not null references public.postos(id) on delete cascade,
  supervisor_id uuid not null,
  data_visita timestamptz not null default now(),
  efetivo_encontrado integer,
  situacao_posto text,
  uniformizacao text,
  equipamentos text,
  procedimentos text,
  irregularidades text,
  providencias text,
  pendencias text,
  pendencia_responsavel text,
  pendencia_prazo date,
  pendencia_resolvida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.visitas to authenticated;
grant insert, update on public.visitas to authenticated;
grant delete on public.visitas to authenticated;
grant all on public.visitas to service_role;

alter table public.visitas enable row level security;

create policy "visitas select" on public.visitas for select to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh')
  or supervisor_id = auth.uid()
);
create policy "visitas insert" on public.visitas for insert to authenticated with check (
  (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'supervisor'))
  and supervisor_id = auth.uid()
);
create policy "visitas update" on public.visitas for update to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or supervisor_id = auth.uid()
);
create policy "visitas delete" on public.visitas for delete to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor')
);

create trigger audit_visitas after insert or update or delete on public.visitas for each row execute function public.audit_trigger();

create or replace function public.trg_notify_visita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare posto_nome text; sup_nome text;
begin
  if new.irregularidades is not null and btrim(new.irregularidades) <> '' then
    select p.nome into posto_nome from public.postos p where p.id = new.posto_id;
    select pr.nome into sup_nome from public.profiles pr where pr.id = new.supervisor_id;
    insert into public.notificacoes (user_id, titulo, mensagem, link)
      select ur.user_id, 'Irregularidade em visita',
        coalesce(sup_nome,'Supervisor') || ' registrou irregularidade no posto ' || coalesce(posto_nome,''), '/visitas'
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id and p.status = 'ativo'
      where ur.role in ('admin','gestor');
  end if;
  return new;
end $$;

create trigger notify_visita after insert on public.visitas for each row execute function public.trg_notify_visita();