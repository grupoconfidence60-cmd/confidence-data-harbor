create table public.escalas (
  id uuid primary key default gen_random_uuid(),
  posto_id uuid not null references public.postos(id) on delete cascade,
  nome text not null,
  tipo text not null default '12x36',
  hora_inicio time not null default '06:00',
  hora_fim time not null default '18:00',
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.escalas(posto_id);
grant select, insert, update, delete on public.escalas to authenticated;
grant all on public.escalas to service_role;
alter table public.escalas enable row level security;
create policy "escalas read" on public.escalas for select to authenticated using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.postos p where p.id = posto_id and p.supervisor_id = auth.uid())
);
create policy "escalas write" on public.escalas for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]));

create table public.escala_colaboradores (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references public.escalas(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  data_inicio date not null default current_date,
  data_fim date,
  created_at timestamptz not null default now(),
  unique (escala_id, colaborador_id, data_inicio)
);
create index on public.escala_colaboradores(escala_id);
create index on public.escala_colaboradores(colaborador_id);
grant select, insert, update, delete on public.escala_colaboradores to authenticated;
grant all on public.escala_colaboradores to service_role;
alter table public.escala_colaboradores enable row level security;
create policy "escala_colab read" on public.escala_colaboradores for select to authenticated using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.escalas e join public.postos p on p.id = e.posto_id where e.id = escala_id and p.supervisor_id = auth.uid())
  or exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
);
create policy "escala_colab write" on public.escala_colaboradores for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]));

create type public.presenca_status as enum ('presente','falta','falta_justificada','atestado','folga','ferias');

create table public.presencas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  posto_id uuid references public.postos(id) on delete set null,
  data date not null,
  status public.presenca_status not null default 'presente',
  hora_entrada timestamptz,
  hora_saida timestamptz,
  justificativa text,
  registrado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (colaborador_id, data)
);
create index on public.presencas(data);
create index on public.presencas(posto_id, data);
grant select, insert, update, delete on public.presencas to authenticated;
grant all on public.presencas to service_role;
alter table public.presencas enable row level security;
create policy "presencas read" on public.presencas for select to authenticated using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.postos p where p.id = posto_id and p.supervisor_id = auth.uid())
  or exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
);
create policy "presencas write" on public.presencas for all to authenticated using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.postos p where p.id = posto_id and p.supervisor_id = auth.uid())
) with check (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.postos p where p.id = posto_id and p.supervisor_id = auth.uid())
);

create type public.ferias_status as enum ('solicitada','aprovada','em_gozo','concluida','recusada');

create table public.ferias (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  periodo_aquisitivo_inicio date,
  periodo_aquisitivo_fim date,
  data_inicio date not null,
  data_fim date not null,
  dias integer not null,
  status public.ferias_status not null default 'solicitada',
  observacoes text,
  aprovado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ferias(colaborador_id);
grant select, insert, update, delete on public.ferias to authenticated;
grant all on public.ferias to service_role;
alter table public.ferias enable row level security;
create policy "ferias read" on public.ferias for select to authenticated using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
  or (public.has_role(auth.uid(),'supervisor') and exists (select 1 from public.colaboradores c join public.postos p on p.id = c.posto_id where c.id = colaborador_id and p.supervisor_id = auth.uid()))
);
create policy "ferias insert" on public.ferias for insert to authenticated with check (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
);
create policy "ferias update" on public.ferias for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[]));
create policy "ferias delete" on public.ferias for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[]));

create type public.ocorrencia_gravidade as enum ('leve','moderada','grave');

create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  posto_id uuid references public.postos(id) on delete set null,
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  tipo text not null,
  titulo text not null,
  descricao text,
  gravidade public.ocorrencia_gravidade not null default 'leve',
  data_ocorrencia timestamptz not null default now(),
  registrado_por uuid,
  resolvida boolean not null default false,
  resolucao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ocorrencias(posto_id);
create index on public.ocorrencias(colaborador_id);
grant select, insert, update, delete on public.ocorrencias to authenticated;
grant all on public.ocorrencias to service_role;
alter table public.ocorrencias enable row level security;
create policy "ocorrencias read" on public.ocorrencias for select to authenticated using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or exists (select 1 from public.postos p where p.id = posto_id and p.supervisor_id = auth.uid())
);
create policy "ocorrencias insert" on public.ocorrencias for insert to authenticated with check (
  public.has_any_role(auth.uid(), array['admin','gestor','rh','supervisor']::public.app_role[])
);
create policy "ocorrencias update" on public.ocorrencias for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]));
create policy "ocorrencias delete" on public.ocorrencias for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create trigger audit_escalas after insert or update or delete on public.escalas for each row execute function public.audit_trigger();
create trigger audit_escala_colab after insert or update or delete on public.escala_colaboradores for each row execute function public.audit_trigger();
create trigger audit_presencas after insert or update or delete on public.presencas for each row execute function public.audit_trigger();
create trigger audit_ferias after insert or update or delete on public.ferias for each row execute function public.audit_trigger();
create trigger audit_ocorrencias after insert or update or delete on public.ocorrencias for each row execute function public.audit_trigger();