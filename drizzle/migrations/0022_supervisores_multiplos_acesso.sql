DROP POLICY IF EXISTS "escalas read" ON public.escalas;
CREATE POLICY "escalas read" ON public.escalas FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND public.supervisiona_posto(posto_id, auth.uid())));

DROP POLICY IF EXISTS "escala_colab read" ON public.escala_colaboradores;
CREATE POLICY "escala_colab read" ON public.escala_colaboradores FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND EXISTS (SELECT 1 FROM public.escalas e WHERE e.id = escala_colaboradores.escala_id AND public.supervisiona_posto(e.posto_id, auth.uid()))) OR public.colaborador_no_posto(NULL, auth.uid()) AND false OR EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id = escala_colaboradores.colaborador_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "presencas read" ON public.presencas;
CREATE POLICY "presencas read" ON public.presencas FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND posto_id IS NOT NULL AND public.supervisiona_posto(posto_id, auth.uid())) OR EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id = presencas.colaborador_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "presencas write" ON public.presencas;
CREATE POLICY "presencas write" ON public.presencas FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND posto_id IS NOT NULL AND public.supervisiona_posto(posto_id, auth.uid()))) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND posto_id IS NOT NULL AND public.supervisiona_posto(posto_id, auth.uid())));

DROP POLICY IF EXISTS "ferias read" ON public.ferias;
CREATE POLICY "ferias read" ON public.ferias FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id = ferias.colaborador_id AND (c.user_id = auth.uid() OR (public.has_role(auth.uid(),'supervisor') AND (c.supervisor_id = auth.uid() OR (c.posto_id IS NOT NULL AND public.supervisiona_posto(c.posto_id, auth.uid())))))));

DROP POLICY IF EXISTS "ocorrencias read" ON public.ocorrencias;
CREATE POLICY "ocorrencias read" ON public.ocorrencias FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND posto_id IS NOT NULL AND public.supervisiona_posto(posto_id, auth.uid())));

DROP POLICY IF EXISTS "visitas select" ON public.visitas;
CREATE POLICY "visitas select" ON public.visitas FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR supervisor_id = auth.uid() OR (public.has_role(auth.uid(),'supervisor') AND public.supervisiona_posto(posto_id, auth.uid())));