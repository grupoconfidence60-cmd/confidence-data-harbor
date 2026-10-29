-- Permite mais de um supervisor por posto.
-- supervisor_id continua sendo o responsável principal (compatibilidade);
-- supervisor_ids guarda todos os supervisores do posto.

alter table public.postos
  add column if not exists supervisor_ids uuid[] not null default '{}'::uuid[];

update public.postos
   set supervisor_ids = array[supervisor_id]
 where supervisor_id is not null
   and cardinality(supervisor_ids) = 0;

create index if not exists postos_supervisor_ids_idx on public.postos using gin (supervisor_ids);

create or replace function public.supervisiona_posto(_posto_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.postos p
    where p.id = _posto_id
      and (p.supervisor_id = _user_id or _user_id = any (p.supervisor_ids))
  )
$$;

grant execute on function public.supervisiona_posto(uuid, uuid) to authenticated;

create or replace function public.can_manage_planilha(_posto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
      or (public.has_role(auth.uid(), 'supervisor') and public.supervisiona_posto(_posto_id, auth.uid()))
$$;

drop policy if exists "postos read" on public.postos;
create policy "postos read" on public.postos
for select to authenticated
using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or supervisor_id = auth.uid()
  or auth.uid() = any (supervisor_ids)
);

drop policy if exists planilha_incluir on public.posto_planilha;
create policy planilha_incluir on public.posto_planilha
for insert to authenticated
with check (
  public.can_manage_planilha(posto_id)
  and exists (
    select 1 from public.colaboradores c
    where c.id = colaborador_id
      and not c.arquivado
      and c.situacao <> 'desligado'
      and (
        public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
        or c.supervisor_id = auth.uid()
        or (c.posto_id is not null and public.supervisiona_posto(c.posto_id, auth.uid()))
      )
  )
);

drop policy if exists planilha_alterar on public.posto_planilha;
create policy planilha_alterar on public.posto_planilha
for update to authenticated
using (public.can_manage_planilha(posto_id))
with check (
  public.can_manage_planilha(posto_id)
  and exists (
    select 1 from public.colaboradores c
    where c.id = colaborador_id
      and (
        public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
        or c.supervisor_id = auth.uid()
        or (c.posto_id is not null and public.supervisiona_posto(c.posto_id, auth.uid()))
      )
  )
);
