CREATE OR REPLACE FUNCTION public.alocar_reserva(_colab uuid, _posto uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para alocar.'; END IF;
  IF NOT (public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::app_role[])
          OR (public.has_role(auth.uid(),'supervisor') AND public.supervisiona_posto(_posto, auth.uid()))) THEN
    RAISE EXCEPTION 'Você não tem permissão para alocar neste posto.';
  END IF;
  UPDATE public.colaboradores SET posto_id = _posto, updated_at = now()
   WHERE id = _colab AND posto_id IS NULL AND arquivado = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não está mais sem posto.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.alocar_reserva(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alocar_reserva(uuid, uuid) TO authenticated;