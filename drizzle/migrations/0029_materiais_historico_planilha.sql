CREATE TABLE public.materiais_historico_planilha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  data date,
  nome text,
  cargo text,
  posto text,
  itens text NOT NULL,
  quantidade numeric,
  valor numeric,
  fornecedor text,
  data_devolucao date,
  observacoes text,
  colaborador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.materiais_historico_planilha TO authenticated;
GRANT ALL ON public.materiais_historico_planilha TO service_role;
ALTER TABLE public.materiais_historico_planilha ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestão lê histórico da planilha" ON public.materiais_historico_planilha FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::app_role[]));