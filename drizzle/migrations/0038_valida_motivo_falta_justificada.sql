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
  IF NEW.justificativa IS NOT NULL AND char_length(NEW.justificativa) > 2000 THEN
    RAISE EXCEPTION 'A justificativa deve ter no máximo 2000 caracteres.';
  END IF;
  IF NEW.status = 'falta_justificada' AND (NEW.justificativa IS NULL OR btrim(NEW.justificativa) = '') THEN
    RAISE EXCEPTION 'Informe o motivo da falta justificada.';
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