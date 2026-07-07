-- Função SECURITY DEFINER para webhook do Mercado Pago atualizar assinaturas
-- Bypassa RLS porque webhooks não têm sessão de usuário
CREATE OR REPLACE FUNCTION webhook_atualizar_assinatura(
  p_pagamento_id TEXT,
  p_status TEXT,
  p_pago BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE assinaturas
  SET 
    status = p_status,
    ultimo_pagamento = CASE WHEN p_pago THEN NOW() ELSE ultimo_pagamento END,
    proximo_pagamento = CASE 
      WHEN p_pago AND fim_periodo IS NULL THEN NOW() + INTERVAL '30 days'
      WHEN p_pago AND fim_periodo < NOW() THEN NOW() + INTERVAL '30 days'
      ELSE proximo_pagamento 
    END,
    fim_periodo = CASE 
      WHEN p_pago AND (fim_periodo IS NULL OR fim_periodo < NOW()) THEN NOW() + INTERVAL '30 days'
      ELSE fim_periodo 
    END
  WHERE intent_pagamento_id = p_pagamento_id;
  
  RETURN FOUND;
END;
$$;
