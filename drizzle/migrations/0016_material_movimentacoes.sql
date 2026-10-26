CREATE TABLE public.material_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materiais(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada','entrega','devolucao','troca','baixa')),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  colaborador_id uuid REFERENCES public.colaboradores(id),
  posto_id uuid REFERENCES public.postos(id),
  supervisor_id uuid REFERENCES public.profiles(id),
  motivo text NOT NULL DEFAULT '',
  registrado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.material_movimentacoes TO authenticated;
GRANT ALL ON public.material_movimentacoes TO service_role;
ALTER TABLE public.material_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.material_saldo(_material_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE tipo WHEN 'entrada' THEN quantidade WHEN 'devolucao' THEN quantidade
    WHEN 'entrega' THEN -quantidade WHEN 'baixa' THEN -quantidade ELSE 0 END),0)::int
  FROM public.material_movimentacoes WHERE material_id = _material_id
$$;

CREATE OR REPLACE FUNCTION public.validate_material_mov() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.registrado_por := auth.uid();
  NEW.created_at := now();
  IF NEW.registrado_por IS NULL THEN RAISE EXCEPTION 'Usuário não identificado'; END IF;
  IF NEW.tipo IN ('entrega','devolucao','troca') AND (NEW.colaborador_id IS NULL OR NEW.posto_id IS NULL) THEN
    RAISE EXCEPTION 'Informe colaborador e posto';
  END IF;
  IF NEW.tipo IN ('entrega','baixa','troca') AND public.material_saldo(NEW.material_id) < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para este material';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_material_mov BEFORE INSERT ON public.material_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.validate_material_mov();
CREATE TRIGGER trg_audit_material_mov AFTER INSERT ON public.material_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE POLICY "mov read" ON public.material_movimentacoes FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::app_role[])
  OR (posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)));
CREATE POLICY "mov insert" ON public.material_movimentacoes FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','rh']::app_role[])
  OR (tipo <> 'entrada' AND tipo <> 'baixa' AND posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)));