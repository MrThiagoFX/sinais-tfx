-- Alerta de fechamento por operação ("estrela por operação"):
-- guarda os signal_id que o usuário marcou ⭐ para ser avisado quando fecharem.
-- Vazio ({}) = não recebe alerta de fechamento de nenhuma operação.
alter table profiles
  add column if not exists close_alerts text[] default '{}';
