-- Adiciona campo para rastrear exclusivamente a última mensagem recebida do cliente (inbound).
-- Usado para calcular se a janela de 24h do WhatsApp está aberta no frontend.
-- NULL = nenhuma mensagem recebida ainda (janela nunca foi aberta).
ALTER TABLE inbox_conversations
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz NULL;
