CREATE OR REPLACE FUNCTION public.presenca_confirmacao_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pode boolean := auth.uid() IS NULL OR public.has_any_role(auth.uid(), ARRAY['admin','rh']::app_role[]);
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT pode AND OLD.confirmado THEN RAISE EXCEPTION 'Registro já confirmado pela Administração/RH; só eles podem alterá-lo.'; END IF;
    RETURN OLD;
  END IF;
  IF pode THEN
    IF NEW.confirmado AND (TG_OP = 'INSERT' OR NOT OLD.confirmado) THEN NEW.confirmado_por := auth.uid(); NEW.confirmado_em := now(); END IF;
    IF NOT NEW.confirmado THEN NEW.confirmado_por := NULL; NEW.confirmado_em := NULL; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.confirmado THEN RAISE EXCEPTION 'Registro já confirmado pela Administração/RH; só eles podem alterá-lo.'; END IF;
  NEW.confirmado := false; NEW.confirmado_por := NULL; NEW.confirmado_em := NULL;
  RETURN NEW;
END $$;

DELETE FROM public.presencas WHERE data <= DATE '2026-11-06';