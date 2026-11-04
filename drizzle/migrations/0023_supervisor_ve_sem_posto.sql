DROP POLICY IF EXISTS "colab read" ON public.colaboradores;
CREATE POLICY "colab read" ON public.colaboradores FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gestor'::app_role,'rh'::app_role])
  OR (public.has_role(auth.uid(),'supervisor'::app_role) AND (supervisor_id = auth.uid() OR posto_id IS NULL OR public.supervisiona_posto(posto_id, auth.uid())))
  OR (user_id = auth.uid() AND public.has_role(auth.uid(),'colaborador'::app_role))
);