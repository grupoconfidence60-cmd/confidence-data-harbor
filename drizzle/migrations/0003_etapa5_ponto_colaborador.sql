create policy "presencas colab insert own" on public.presencas for insert to authenticated with check (
  public.has_role(auth.uid(),'colaborador')
  and data = current_date
  and exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid() and c.arquivado = false)
);

create policy "presencas colab update own" on public.presencas for update to authenticated using (
  public.has_role(auth.uid(),'colaborador')
  and data = current_date
  and exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
) with check (
  data = current_date
  and exists (select 1 from public.colaboradores c where c.id = colaborador_id and c.user_id = auth.uid())
);