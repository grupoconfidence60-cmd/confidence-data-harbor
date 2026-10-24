DROP POLICY IF EXISTS "presencas colab insert own" ON public.presencas;
CREATE POLICY "presencas colab insert own" ON public.presencas FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(),'colaborador') AND data = CURRENT_DATE
  AND EXISTS (SELECT 1 FROM colaboradores c WHERE c.id = presencas.colaborador_id AND c.user_id = auth.uid() AND c.arquivado = false)
  AND (NOT EXISTS (SELECT 1 FROM postos p WHERE p.id = presencas.posto_id AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL)
    OR (presencas.latitude IS NOT NULL AND presencas.longitude IS NOT NULL AND EXISTS (SELECT 1 FROM postos p WHERE p.id = presencas.posto_id
      AND distancia_metros(p.latitude,p.longitude,presencas.latitude,presencas.longitude) <= p.raio_metros))));
DROP POLICY IF EXISTS "presencas colab update own" ON public.presencas;
CREATE POLICY "presencas colab update own" ON public.presencas FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'colaborador') AND data = CURRENT_DATE AND EXISTS (SELECT 1 FROM colaboradores c WHERE c.id = presencas.colaborador_id AND c.user_id = auth.uid()))
WITH CHECK (data = CURRENT_DATE AND EXISTS (SELECT 1 FROM colaboradores c WHERE c.id = presencas.colaborador_id AND c.user_id = auth.uid())
  AND (NOT EXISTS (SELECT 1 FROM postos p WHERE p.id = presencas.posto_id AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL)
    OR (presencas.latitude IS NOT NULL AND presencas.longitude IS NOT NULL AND EXISTS (SELECT 1 FROM postos p WHERE p.id = presencas.posto_id
      AND distancia_metros(p.latitude,p.longitude,presencas.latitude,presencas.longitude) <= p.raio_metros))));
CREATE POLICY "postos colab read own" ON public.postos FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'colaborador') AND EXISTS (SELECT 1 FROM colaboradores c WHERE c.posto_id = postos.id AND c.user_id = auth.uid() AND c.arquivado = false));
ALTER TABLE public.ocorrencias ALTER COLUMN registrado_por SET DEFAULT auth.uid();
CREATE POLICY "ocorrencias colab insert own" ON public.ocorrencias FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(),'colaborador') AND registrado_por = auth.uid()
  AND (posto_id IS NULL OR EXISTS (SELECT 1 FROM colaboradores c WHERE c.posto_id = ocorrencias.posto_id AND c.user_id = auth.uid() AND c.arquivado = false)));
CREATE POLICY "ocorrencias colab read own" ON public.ocorrencias FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'colaborador') AND registrado_por = auth.uid());