-- Cupom de aluno: código que o admin gera/edita. Quem se cadastrar com esse
-- cupom é liberado automaticamente como "aluno" por 15 dias (o admin depois
-- pode mudar para "sem limite" no painel).
alter table app_settings
  add column if not exists aluno_coupon text;
