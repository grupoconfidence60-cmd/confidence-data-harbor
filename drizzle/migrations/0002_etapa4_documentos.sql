create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  tipo text not null default 'Outro',
  titulo text not null,
  arquivo_path text not null,
  arquivo_nome text not null,
  observacao text,
  enviado_por uuid,
  created_at timestamptz not null default now()
);

grant select on public.documentos to authenticated;
grant insert, update, delete on public.documentos to authenticated;
grant all on public.documentos to service_role;

alter table public.documentos enable row level security;

create policy "documentos select" on public.documentos for select to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh') or public.has_role(auth.uid(),'supervisor')
  or exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
);
create policy "documentos insert" on public.documentos for insert to authenticated with check (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh')
);
create policy "documentos update" on public.documentos for update to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh')
);
create policy "documentos delete" on public.documentos for delete to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh')
);

create trigger audit_documentos after insert or update or delete on public.documentos for each row execute function public.audit_trigger();

create policy "documentos storage read" on storage.objects for select to authenticated using (
  bucket_id = 'documentos' and (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh') or public.has_role(auth.uid(),'supervisor')
    or exists (select 1 from public.documentos d join public.colaboradores c on c.id = d.colaborador_id where d.arquivo_path = name and c.user_id = auth.uid())
  )
);
create policy "documentos storage write" on storage.objects for insert to authenticated with check (
  bucket_id = 'documentos' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh'))
);
create policy "documentos storage delete" on storage.objects for delete to authenticated using (
  bucket_id = 'documentos' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'rh'))
);