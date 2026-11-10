create table public.supervisor_funcoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  funcao_id uuid not null references public.funcoes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, funcao_id)
);
grant select on public.supervisor_funcoes to authenticated;
grant all on public.supervisor_funcoes to service_role;
alter table public.supervisor_funcoes enable row level security;
create policy "sf read" on public.supervisor_funcoes for select to authenticated using (user_id = auth.uid() or has_any_role(auth.uid(), array['admin','gestor','rh']::app_role[]));
create policy "sf write" on public.supervisor_funcoes for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create trigger audit_supervisor_funcoes after insert or update or delete on public.supervisor_funcoes for each row execute function public.audit_trigger();

create or replace function public.supervisor_funcao_ok(_funcao_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from supervisor_funcoes where user_id = _user_id)
      or exists (select 1 from supervisor_funcoes where user_id = _user_id and funcao_id = _funcao_id)
$$;

drop policy "colab read" on public.colaboradores;
create policy "colab read" on public.colaboradores for select to authenticated using (
  has_any_role(auth.uid(), array['admin','gestor','rh']::app_role[])
  or (has_role(auth.uid(),'supervisor') and supervisor_funcao_ok(funcao_id, auth.uid())
      and (supervisor_id = auth.uid() or posto_id is null or supervisiona_posto(posto_id, auth.uid())))
  or (user_id = auth.uid() and has_role(auth.uid(),'colaborador'))
);

insert into public.supervisor_funcoes (user_id, funcao_id)
select 'ae0399e2-5e4d-4252-b260-7727e0c534d2', id from public.funcoes where nome in ('Bombeiro Civil','Bombeiro Civil Intermitente');