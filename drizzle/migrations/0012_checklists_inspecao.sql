CREATE TABLE public.checklist_modelos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 160), itens text[] NOT NULL CHECK (cardinality(itens) BETWEEN 1 AND 60), arquivado boolean NOT NULL DEFAULT false, criado_por uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.checklist_modelos TO authenticated;
GRANT ALL ON public.checklist_modelos TO service_role;
ALTER TABLE public.checklist_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY modelos_read ON public.checklist_modelos FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh','supervisor']::public.app_role[]));
CREATE POLICY modelos_insert ON public.checklist_modelos FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[]));
CREATE POLICY modelos_update ON public.checklist_modelos FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[]));
CREATE TRIGGER audit_checklist_modelos AFTER INSERT OR UPDATE OR DELETE ON public.checklist_modelos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.inspecoes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), modelo_id uuid NOT NULL REFERENCES public.checklist_modelos(id), posto_id uuid NOT NULL REFERENCES public.postos(id), data date NOT NULL DEFAULT current_date, respostas jsonb NOT NULL CHECK (jsonb_typeof(respostas) = 'array' AND jsonb_array_length(respostas) >= 1), nao_conformes int NOT NULL DEFAULT 0 CHECK (nao_conformes >= 0), observacoes text NOT NULL DEFAULT '' CHECK (length(observacoes) <= 2000), realizado_por uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX inspecoes_posto_data ON public.inspecoes (posto_id, data DESC);
GRANT SELECT, INSERT ON public.inspecoes TO authenticated;
GRANT ALL ON public.inspecoes TO service_role;
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY inspecoes_read ON public.inspecoes FOR SELECT TO authenticated USING (public.can_manage_planilha(posto_id));
CREATE POLICY inspecoes_insert ON public.inspecoes FOR INSERT TO authenticated WITH CHECK (public.can_manage_planilha(posto_id) AND realizado_por = auth.uid() AND public.has_any_role(auth.uid(), ARRAY['admin','gestor','supervisor']::public.app_role[]));
CREATE OR REPLACE FUNCTION public.validate_inspecao() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.checklist_modelos WHERE id = NEW.modelo_id AND NOT arquivado) THEN RAISE EXCEPTION 'Checklist indisponível'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.respostas) r WHERE NOT (r->>'status' = ANY (ARRAY['conforme','nao_conforme','na'])) OR coalesce(r->>'item','') = '') THEN RAISE EXCEPTION 'Respostas inválidas'; END IF;
  NEW.nao_conformes := (SELECT count(*) FROM jsonb_array_elements(NEW.respostas) r WHERE r->>'status' = 'nao_conforme');
  RETURN NEW;
END $$;
CREATE TRIGGER validate_inspecao BEFORE INSERT ON public.inspecoes FOR EACH ROW EXECUTE FUNCTION public.validate_inspecao();
CREATE TRIGGER audit_inspecoes AFTER INSERT OR UPDATE OR DELETE ON public.inspecoes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();