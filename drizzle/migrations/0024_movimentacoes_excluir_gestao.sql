CREATE POLICY "movimentacoes excluir gestao"
ON public.material_movimentacoes
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::app_role[]));