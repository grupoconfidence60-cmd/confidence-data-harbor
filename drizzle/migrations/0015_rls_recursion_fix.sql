-- Corrige recursão infinita nas políticas RLS: as políticas de "postos" e
-- "colaboradores" consultavam uma a outra. As consultas cruzadas agora passam
-- por funções SECURITY DEFINER, que não reavaliam RLS.

create or replace function public.colaborador_no_posto(_posto_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.colaboradores c
    where c.posto_id = _posto_id and c.user_id = _user_id and c.arquivado = false
  )
$$;

create or replace function public.supervisiona_posto(_posto_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.postos p
    where p.id = _posto_id and p.supervisor_id = _user_id
  )
$$;

grant execute on function public.colaborador_no_posto(uuid, uuid) to authenticated;
grant execute on function public.supervisiona_posto(uuid, uuid) to authenticated;

drop policy if exists "colab read" on public.colaboradores;
create policy "colab read" on public.colaboradores
for select
using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or (
    public.has_role(auth.uid(), 'supervisor')
    and (
      supervisor_id = auth.uid()
      or (posto_id is not null and public.supervisiona_posto(posto_id, auth.uid()))
    )
  )
  or (user_id = auth.uid() and public.has_role(auth.uid(), 'colaborador'))
);

drop policy if exists "postos colab read own" on public.postos;
create policy "postos colab read own" on public.postos
for select
using (
  public.has_role(auth.uid(), 'colaborador')
  and public.colaborador_no_posto(id, auth.uid())
);
