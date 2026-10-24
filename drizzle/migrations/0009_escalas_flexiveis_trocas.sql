ALTER TABLE public.posto_planilha ADD COLUMN escala_tipo text;
UPDATE public.posto_planilha SET escala_tipo=paridade WHERE escala_tipo IS NULL;
ALTER TABLE public.posto_planilha ADD CONSTRAINT planilha_escala_tipo CHECK(escala_tipo IN ('par','impar','5x2','6x1','diaria','livre'));
CREATE OR REPLACE FUNCTION public.trocar_plantao(origem uuid, destino uuid, dia_origem integer, dia_destino integer) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='public' AS $$
DECLARE a public.posto_planilha; b public.posto_planilha; sa text; sb text; wa integer; wb integer;
BEGIN
 PERFORM id FROM public.posto_planilha WHERE id IN (origem,destino) ORDER BY id FOR UPDATE;
 SELECT * INTO a FROM public.posto_planilha WHERE id=origem AND NOT removido;
 SELECT * INTO b FROM public.posto_planilha WHERE id=destino AND NOT removido;
 IF a.id IS NULL OR b.id IS NULL OR a.posto_id<>b.posto_id OR a.mes<>b.mes OR NOT public.can_manage_planilha(a.posto_id) THEN RAISE EXCEPTION 'Troca não permitida'; END IF;
 IF dia_origem<1 OR dia_destino<1 OR dia_origem>extract(day from(a.mes+interval '1 month - 1 day')) OR dia_destino>extract(day from(b.mes+interval '1 month - 1 day')) THEN RAISE EXCEPTION 'Dia inválido'; END IF;
 wa:=extract(isodow from(a.mes+dia_origem-1)); wb:=extract(isodow from(b.mes+dia_destino-1));
 sa:=coalesce(a.ajustes->>dia_origem::text,CASE WHEN coalesce(a.escala_tipo,a.paridade)='par' AND dia_origem%2=0 OR coalesce(a.escala_tipo,a.paridade)='impar' AND dia_origem%2=1 OR a.escala_tipo='5x2' AND wa<=5 OR a.escala_tipo='6x1' AND wa<=6 OR a.escala_tipo='diaria' THEN 'T' ELSE 'F' END);
 sb:=coalesce(b.ajustes->>dia_destino::text,CASE WHEN coalesce(b.escala_tipo,b.paridade)='par' AND dia_destino%2=0 OR coalesce(b.escala_tipo,b.paridade)='impar' AND dia_destino%2=1 OR b.escala_tipo='5x2' AND wb<=5 OR b.escala_tipo='6x1' AND wb<=6 OR b.escala_tipo='diaria' THEN 'T' ELSE 'F' END);
 IF origem=destino THEN UPDATE public.posto_planilha SET ajustes=jsonb_set(jsonb_set(ajustes,ARRAY[dia_origem::text],to_jsonb(sb)),ARRAY[dia_destino::text],to_jsonb(sa)) WHERE id=origem;
 ELSE UPDATE public.posto_planilha SET ajustes=jsonb_set(ajustes,ARRAY[dia_origem::text],to_jsonb(sb)) WHERE id=origem; UPDATE public.posto_planilha SET ajustes=jsonb_set(ajustes,ARRAY[dia_destino::text],to_jsonb(sa)) WHERE id=destino; END IF;
END $$;
REVOKE ALL ON FUNCTION public.trocar_plantao(uuid,uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trocar_plantao(uuid,uuid,integer,integer) TO authenticated;
COMMENT ON COLUMN public.posto_planilha.paridade IS 'DEPRECATED: replaced by escala_tipo; retained for older clients';