CREATE OR REPLACE FUNCTION public.cadastrar_tamanhos_uniforme(
  p_nome text,
  p_categoria text,
  p_tamanhos text[],
  p_identificacao text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_nome text := regexp_replace(btrim(p_nome), '[[:space:]]+', ' ', 'g');
  v_tamanho text;
  v_existente public.materiais%ROWTYPE;
  v_criados integer := 0;
  v_existentes integer := 0;
  v_reativados integer := 0;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar uniformes.';
  END IF;
  IF v_nome IS NULL OR v_nome = '' OR length(v_nome) > 160 THEN
    RAISE EXCEPTION 'Informe um nome de uniforme com até 160 caracteres.';
  END IF;
  IF p_categoria IS NULL OR lower(btrim(p_categoria)) NOT IN ('uniforme', 'uniformes') THEN
    RAISE EXCEPTION 'Selecione uma categoria de uniforme.';
  END IF;
  IF p_tamanhos IS NULL OR cardinality(p_tamanhos) = 0 OR array_position(p_tamanhos, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Informe os tamanhos a cadastrar.';
  END IF;

  -- Serializa o cadastro com outras gravações no catálogo. A função inteira
  -- é executada em uma transação, mantendo também as políticas RLS existentes.
  LOCK TABLE public.materiais IN SHARE ROW EXCLUSIVE MODE;

  FOR v_tamanho IN
    SELECT min(regexp_replace(btrim(t.valor), '[[:space:]]+', ' ', 'g'))
    FROM unnest(p_tamanhos) AS t(valor)
    GROUP BY lower(regexp_replace(btrim(t.valor), '[[:space:]]+', ' ', 'g'))
  LOOP
    SELECT m.* INTO v_existente
    FROM public.materiais AS m
    WHERE lower(regexp_replace(btrim(m.nome), '[[:space:]]+', ' ', 'g')) = lower(v_nome)
      AND lower(regexp_replace(btrim(m.tamanho), '[[:space:]]+', ' ', 'g')) = lower(v_tamanho)
    ORDER BY m.arquivado, m.created_at, m.id
    LIMIT 1;

    IF FOUND THEN
      IF lower(btrim(v_existente.categoria)) NOT IN ('uniforme', 'uniformes') THEN
        RAISE EXCEPTION 'Já existe um material com esse nome e tamanho em outra categoria.';
      END IF;
      IF v_existente.arquivado THEN
        UPDATE public.materiais SET arquivado = false WHERE id = v_existente.id;
        v_reativados := v_reativados + 1;
      ELSE
        v_existentes := v_existentes + 1;
      END IF;
    ELSE
      INSERT INTO public.materiais (nome, categoria, tamanho, identificacao, arquivado)
      VALUES (v_nome, p_categoria, v_tamanho, btrim(coalesce(p_identificacao, '')), false);
      v_criados := v_criados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('criados', v_criados, 'existentes', v_existentes, 'reativados', v_reativados);
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.cadastrar_tamanhos_uniforme(text, text, text[], text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cadastrar_tamanhos_uniforme(text, text, text[], text) TO authenticated;
