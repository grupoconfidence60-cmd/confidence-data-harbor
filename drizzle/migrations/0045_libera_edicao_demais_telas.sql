DROP POLICY IF EXISTS "mov insert" ON public.material_movimentacoes;
CREATE POLICY "mov insert" ON public.material_movimentacoes FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR ((tipo <> ALL (ARRAY['entrada','baixa'])) AND (((posto_id IS NOT NULL) AND public.can_manage_planilha(posto_id)) OR ((posto_id IS NULL) AND (colaborador_id IS NOT NULL) AND public.can_manage_material_reserva(colaborador_id)))));

DROP POLICY IF EXISTS comunicados_arquivar ON public.comunicados;
CREATE POLICY comunicados_arquivar ON public.comunicados FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR publicado_por = auth.uid())
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR publicado_por = auth.uid());

CREATE POLICY "ferias update supervisor" ON public.ferias FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'supervisor') AND EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id = ferias.colaborador_id AND (c.supervisor_id = auth.uid() OR c.posto_id IS NULL OR public.supervisiona_posto(c.posto_id, auth.uid()))))
WITH CHECK (public.has_role(auth.uid(),'supervisor') AND EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id = ferias.colaborador_id AND (c.supervisor_id = auth.uid() OR c.posto_id IS NULL OR public.supervisiona_posto(c.posto_id, auth.uid()))));

CREATE POLICY "colab update supervisor" ON public.colaboradores FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'supervisor') AND (posto_id IS NULL OR public.supervisiona_posto(posto_id, auth.uid())) AND public.supervisor_funcao_ok(funcao_id, auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'supervisor') AND (posto_id IS NULL OR public.supervisiona_posto(posto_id, auth.uid())));

DROP POLICY IF EXISTS "sf write" ON public.supervisor_funcoes;
CREATE POLICY "sf write" ON public.supervisor_funcoes FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]));