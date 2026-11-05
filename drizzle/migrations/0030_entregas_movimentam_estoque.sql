CREATE OR REPLACE FUNCTION public.entrega_para_estoque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.material_movimentacoes (tipo, material_id, quantidade, colaborador_id, posto_id, motivo)
    VALUES ('entrega', NEW.material_id, NEW.quantidade, NEW.colaborador_id, NEW.posto_id, trim(concat('Entrega registrada ', NEW.observacoes)));
  ELSIF OLD.data_devolucao IS NULL AND NEW.data_devolucao IS NOT NULL THEN
    INSERT INTO public.material_movimentacoes (tipo, material_id, quantidade, colaborador_id, posto_id, motivo)
    VALUES ('devolucao', NEW.material_id, NEW.quantidade, NEW.colaborador_id, NEW.posto_id, concat('Devolução (', coalesce(NEW.condicao_devolucao,'bom'), ')'));
    IF coalesce(NEW.condicao_devolucao,'bom') <> 'bom' THEN
      INSERT INTO public.material_movimentacoes (tipo, material_id, quantidade, colaborador_id, posto_id, motivo)
      VALUES ('baixa', NEW.material_id, NEW.quantidade, NEW.colaborador_id, NEW.posto_id, concat('Devolvido ', NEW.condicao_devolucao, ' — retirado do estoque'));
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.entrega_para_estoque() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_entrega_para_estoque AFTER INSERT OR UPDATE ON public.material_entregas
FOR EACH ROW EXECUTE FUNCTION public.entrega_para_estoque();