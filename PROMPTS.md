# PROMPTS — copie e cole no Claude Code, um por fase

> Dica: o Claude Code já lê o CLAUDE.md sozinho. Estes prompts só apontam a fase.

## Prompt inicial (cole primeiro)
```
Leia o CLAUDE.md e o ROADMAP.md deste projeto. Me dê um resumo do que está pronto
e do que falta, e então execute a Fase 0 (rodar local). Não avance de fase sem eu
aprovar.
```

## Fase 1 — Deploy
```
Execute a Fase 1 do ROADMAP: deploy na Vercel. Use npx vercel. Quando precisar de
login, me avise que eu autorizo no navegador. Ao final, me dê a URL de produção e
confirme que o PWA está instalável.
```

## Fase 2 — Supabase
```
Execute a Fase 2. Já criei o projeto no Supabase. Aqui estão as credenciais:
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
Rode o schema.sql (me passe o conteúdo para eu colar no SQL Editor, ou use a API),
configure o .env e as env vars na Vercel, e valide um signup de teste.
```

## Fase 3 — Backend
```
Execute a Fase 3: finalize api/signals.js e api/stats.js conforme o ROADMAP e as
regras de negócio do CLAUDE.md (validação de payload, token MT4, filtro por
plano/ativos/timeframes/janela de horário, cota diária). Depois me mostre os
comandos curl de teste e rode-os.
```

## Fase 4 — Push
```
Execute a Fase 4: gere as chaves VAPID, complete api/push/subscribe.js, adicione a
inscrição de push no frontend após o login e dispare push no POST /api/signals.
Teste com um sinal fake e me diga como verificar no celular.
```

## Fase 5 — Integração frontend
```
Execute a Fase 5: crie src/lib/supabase.js e src/lib/api.js, implemente login real,
persista as preferências do usuário no Supabase e troque os mocks do feed,
histórico e desempenho por dados da API, mantendo fallback visual. Não quebre
nenhuma regra de UI do CLAUDE.md.
```

## Fase 6 — MT4
```
Revise mt4/InfinitySignalsSender.mq4: configure a URL de produção e o token, e me
explique passo a passo como compilar no MetaEditor e liberar o WebRequest no MT4.
```

## Fase 7 — APK
```
Execute a Fase 7 pelo caminho B (Capacitor): build, adicionar Android, sync e
gerar o APK de debug. Se faltar Android SDK na minha máquina, me guie na instalação.
```

## Testes rápidos (curl)
```bash
# health
curl https://SEU-APP.vercel.app/api/health

# postar sinal (igual ao que o MT4 enviará)
curl -X POST https://SEU-APP.vercel.app/api/signals \
  -H "Content-Type: application/json" \
  -H "x-mt4-token: SEU_TOKEN" \
  -d '{"asset":"XAUUSD","dir":"Compra","tf":"M5","entry":2365.40,"sl":2360.00,"tp":2373.00}'
```
