DROP POLICY IF EXISTS comunicados_publicar ON public.comunicados;
CREATE POLICY comunicados_publicar ON public.comunicados FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]) AND publicado_por = auth.uid());