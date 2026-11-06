ALTER TABLE public.presencas
  ADD COLUMN cobertura_colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL;

ALTER TABLE public.presencas
  ADD CONSTRAINT presencas_cobertura_diferente
  CHECK (cobertura_colaborador_id IS NULL OR cobertura_colaborador_id <> colaborador_id);

ALTER TABLE public.documentos
  ADD COLUMN presenca_id uuid REFERENCES public.presencas(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX documentos_presenca_unica
  ON public.documentos(presenca_id) WHERE presenca_id IS NOT NULL;
CREATE INDEX presencas_cobertura_idx ON public.presencas(cobertura_colaborador_id);

CREATE OR REPLACE FUNCTION public.presenca_confirmacao_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pode boolean := auth.uid() IS NULL OR public.has_any_role(auth.uid(), ARRAY['admin','rh']::app_role[]);
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT pode AND OLD.confirmado THEN
      RAISE EXCEPTION 'Registro já confirmado pela Administração/RH; só eles podem alterá-lo.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.cobertura_colaborador_id IS NOT NULL AND NEW.cobertura_colaborador_id = NEW.colaborador_id THEN
    RAISE EXCEPTION 'A cobertura deve ser outro colaborador.';
  END IF;
  IF pode THEN
    IF NEW.confirmado AND (TG_OP = 'INSERT' OR NOT OLD.confirmado) THEN
      NEW.confirmado_por := auth.uid();
      NEW.confirmado_em := now();
    END IF;
    IF NOT NEW.confirmado THEN
      NEW.confirmado_por := NULL;
      NEW.confirmado_em := NULL;
    END IF;
  ELSE
    IF TG_OP = 'UPDATE' AND OLD.confirmado THEN
      RAISE EXCEPTION 'Registro já confirmado pela Administração/RH; só eles podem alterá-lo.';
    END IF;
    NEW.confirmado := false;
    NEW.confirmado_por := NULL;
    NEW.confirmado_em := NULL;
  END IF;
  IF NEW.confirmado AND NEW.status = 'falta_justificada' AND NOT EXISTS (
    SELECT 1 FROM public.documentos d WHERE d.presenca_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Anexe a justificativa em Documentos antes de confirmar esta falta.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.documento_presenca_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.presenca_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.presencas pr
      WHERE pr.id = OLD.presenca_id AND pr.confirmado AND pr.status = 'falta_justificada'
    ) THEN
      RAISE EXCEPTION 'Retire a confirmação da falta antes de excluir a justificativa anexada.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.presenca_id IS NOT NULL THEN
    SELECT pr.colaborador_id, pr.status INTO p FROM public.presencas pr WHERE pr.id = NEW.presenca_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lançamento de presença não encontrado.';
    END IF;
    IF p.colaborador_id <> NEW.colaborador_id THEN
      RAISE EXCEPTION 'O documento e a falta devem pertencer ao mesmo colaborador.';
    END IF;
    IF TG_OP = 'INSERT' AND p.status <> 'falta_justificada' THEN
      RAISE EXCEPTION 'Este anexo só pode ser vinculado a uma falta justificada.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER documento_presenca_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.documento_presenca_guard();

CREATE POLICY "documentos insert supervisor justificativa"
ON public.documentos FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'supervisor')
  AND presenca_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.presencas pr
    WHERE pr.id = presenca_id
      AND pr.colaborador_id = documentos.colaborador_id
      AND pr.status = 'falta_justificada'
      AND pr.posto_id IS NOT NULL
      AND public.supervisiona_posto(pr.posto_id, auth.uid())
  )
);

CREATE POLICY "documentos storage write supervisor justificativa"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND public.has_role(auth.uid(), 'supervisor')
  AND EXISTS (
    SELECT 1 FROM public.presencas pr
    WHERE pr.colaborador_id::text = (storage.foldername(name))[1]
      AND pr.status = 'falta_justificada'
      AND pr.posto_id IS NOT NULL
      AND public.supervisiona_posto(pr.posto_id, auth.uid())
  )
);