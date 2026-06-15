-- Operações favoritas: ativos que o usuário quer ser notificado.
-- Vazio ({}) = recebe todos os sinais elegíveis (padrão).
-- Com ativos = o push (entrada e conclusão) só dispara para esses.
alter table profiles
  add column if not exists notify_favorites text[] default '{}';
