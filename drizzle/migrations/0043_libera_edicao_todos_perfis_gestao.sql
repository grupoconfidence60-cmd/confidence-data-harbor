DROP POLICY IF EXISTS "postos write" ON public.postos;
CREATE POLICY "postos write" ON public.postos FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]));
CREATE POLICY "postos update supervisor" ON public.postos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'supervisor') AND public.supervisiona_posto(id, auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'supervisor') AND public.supervisiona_posto(id, auth.uid()));

DROP POLICY IF EXISTS "escalas write" ON public.escalas;
CREATE POLICY "escalas write" ON public.escalas FOR ALL TO authenticated
USING (public.can_manage_planilha(posto_id)) WITH CHECK (public.can_manage_planilha(posto_id));

DROP POLICY IF EXISTS "funcoes write" ON public.funcoes;
CREATE POLICY "funcoes write" ON public.funcoes FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]));

DROP POLICY IF EXISTS modelos_insert ON public.checklist_modelos;
CREATE POLICY modelos_insert ON public.checklist_modelos FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]));
DROP POLICY IF EXISTS modelos_update ON public.checklist_modelos;
CREATE POLICY modelos_update ON public.checklist_modelos FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]));

DROP POLICY IF EXISTS inspecoes_insert ON public.inspecoes;
CREATE POLICY inspecoes_insert ON public.inspecoes FOR INSERT TO authenticated
WITH CHECK (public.can_manage_planilha(posto_id) AND realizado_por = auth.uid());

DROP POLICY IF EXISTS "visitas insert" ON public.visitas;
CREATE POLICY "visitas insert" ON public.visitas FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]) AND supervisor_id = auth.uid());
DROP POLICY IF EXISTS "visitas update" ON public.visitas;
CREATE POLICY "visitas update" ON public.visitas FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR supervisor_id = auth.uid());
DROP POLICY IF EXISTS "visitas delete" ON public.visitas;
CREATE POLICY "visitas delete" ON public.visitas FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]));

DROP POLICY IF EXISTS "ocorrencias update" ON public.ocorrencias;
CREATE POLICY "ocorrencias update" ON public.ocorrencias FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]));
DROP POLICY IF EXISTS "ocorrencias delete" ON public.ocorrencias;
CREATE POLICY "ocorrencias delete" ON public.ocorrencias FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]));