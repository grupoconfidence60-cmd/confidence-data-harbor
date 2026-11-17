CREATE OR REPLACE FUNCTION public.alocar_reserva(_colab uuid, _posto uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _destino_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para alocar.';
  END IF;

  SELECT p.nome INTO _destino_nome
  FROM public.postos p
  WHERE p.id = _posto AND p.ativo = true;

  IF _destino_nome IS NULL THEN
    RAISE EXCEPTION 'Selecione um posto ativo.';
  END IF;

  IF NOT (
    public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[])
    OR (
      public.has_role(auth.uid(), 'supervisor')
      AND public.supervisiona_posto(_posto, auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.colaboradores c
        WHERE c.id = _colab
          AND public.supervisor_funcao_ok(c.funcao_id, auth.uid())
      )
    )
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para alocar este colaborador neste posto.';
  END IF;

  UPDATE public.colaboradores
  SET posto_id = _posto,
      disponibilidade_status = 'ocupado',
      disponibilidade_detalhe = _destino_nome,
      updated_at = now()
  WHERE id = _colab
    AND arquivado = false
    AND situacao <> 'desligado'
    AND (
      posto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.postos origem
        WHERE origem.id = colaboradores.posto_id
          AND lower(origem.tipo) = 'intermitentes'
      )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não está mais sem posto ou no banco de intermitentes.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.alocar_reserva(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alocar_reserva(uuid, uuid) TO authenticated;