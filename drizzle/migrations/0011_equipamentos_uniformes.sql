CREATE TABLE public.materiais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL CHECK (length(btrim(nome)) > 0), categoria text NOT NULL CHECK (categoria IN ('equipamento','uniforme')), tamanho text NOT NULL DEFAULT '', identificacao text NOT NULL DEFAULT '', arquivado boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.materiais TO authenticated;
GRANT ALL ON public.materiais TO service_role;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY materiais_read ON public.materiais FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]));
CREATE POLICY materiais_insert ON public.materiais FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]));
CREATE POLICY materiais_update ON public.materiais FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]));
CREATE TRIGGER audit_materiais AFTER INSERT OR UPDATE OR DELETE ON public.materiais FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TABLE public.material_entregas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), material_id uuid NOT NULL REFERENCES public.materiais(id), colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id), posto_id uuid NOT NULL REFERENCES public.postos(id), quantidade integer NOT NULL CHECK (quantidade > 0), data_entrega date NOT NULL, data_devolucao date, condicao_devolucao text CHECK (condicao_devolucao IN ('bom','danificado','inutilizado')), observacoes text NOT NULL DEFAULT '', registrado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id), devolvido_por uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), CHECK (data_devolucao IS NULL OR data_devolucao >= data_entrega), CHECK ((data_devolucao IS NULL AND condicao_devolucao IS NULL) OR (data_devolucao IS NOT NULL AND condicao_devolucao IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE ON public.material_entregas TO authenticated;
GRANT ALL ON public.material_entregas TO service_role;
ALTER TABLE public.material_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY entregas_read ON public.material_entregas FOR SELECT TO authenticated USING (public.can_manage_planilha(posto_id));
CREATE POLICY entregas_insert ON public.material_entregas FOR INSERT TO authenticated WITH CHECK (public.can_manage_planilha(posto_id) AND registrado_por = auth.uid());
CREATE POLICY entregas_update ON public.material_entregas FOR UPDATE TO authenticated USING (public.can_manage_planilha(posto_id)) WITH CHECK (public.can_manage_planilha(posto_id));
CREATE FUNCTION public.validate_material_entrega() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NOT EXISTS (SELECT 1 FROM public.materiais WHERE id = NEW.material_id AND NOT arquivado) THEN RAISE EXCEPTION 'Material indisponível para entrega.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.colaboradores WHERE id = NEW.colaborador_id AND NOT arquivado) THEN RAISE EXCEPTION 'Colaborador indisponível para entrega.'; END IF;
  NEW.registrado_por := auth.uid(); NEW.data_devolucao := NULL; NEW.condicao_devolucao := NULL; NEW.devolvido_por := NULL;
 ELSE
  IF OLD.data_devolucao IS NOT NULL THEN RAISE EXCEPTION 'Devolução já registrada.'; END IF;
  IF (NEW.material_id, NEW.colaborador_id, NEW.posto_id, NEW.quantidade, NEW.data_entrega, NEW.observacoes, NEW.registrado_por, NEW.created_at, NEW.id) IS DISTINCT FROM (OLD.material_id, OLD.colaborador_id, OLD.posto_id, OLD.quantidade, OLD.data_entrega, OLD.observacoes, OLD.registrado_por, OLD.created_at, OLD.id) THEN RAISE EXCEPTION 'O histórico da entrega não pode ser alterado.'; END IF;
  IF NEW.data_devolucao IS NULL THEN RAISE EXCEPTION 'Informe a data de devolução.'; END IF;
  NEW.devolvido_por := auth.uid();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_material_entrega BEFORE INSERT OR UPDATE ON public.material_entregas FOR EACH ROW EXECUTE FUNCTION public.validate_material_entrega();
CREATE TRIGGER audit_material_entregas AFTER INSERT OR UPDATE OR DELETE ON public.material_entregas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE INDEX material_entregas_posto_idx ON public.material_entregas(posto_id, data_entrega);
CREATE INDEX material_entregas_colaborador_idx ON public.material_entregas(colaborador_id);