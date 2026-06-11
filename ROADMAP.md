# ROADMAP — Infinity Signals (executar com Claude Code)

Cada fase tem **objetivo**, **passos** e **critério de aceite**. Execute em ordem.
Os prompts prontos para cada fase estão em `PROMPTS.md`.

---

## Fase 0 — Rodar local ✦ (5 min)
**Objetivo:** garantir que o projeto compila e roda.
1. `npm install`
2. `npm run dev` → abrir http://localhost:5173
3. Testar: trocar tema, navegar pelas 15 telas, trocar plano no painel dev

**Aceite:** app abre sem erros no console; tema claro/escuro alterna; scroll funciona.

---

## Fase 1 — Deploy na Vercel ✦ (10 min)
**Objetivo:** app online com URL pública e PWA instalável.
1. `npx vercel login` (usuário confirma no navegador)
2. `npx vercel` (preview) → validar → `npx vercel --prod`
3. Abrir a URL no celular → "Adicionar à tela de início" → confirmar que abre standalone

**Aceite:** URL https pública; Lighthouse PWA "installable"; sw.js registrado
(DevTools → Application → Service Workers).

---

## Fase 2 — Supabase (banco + auth) ✦ (30 min)
**Objetivo:** banco real com login por e-mail/senha.
1. Usuário cria projeto em supabase.com (gratuito) e fornece URL + chaves
2. Rodar `supabase/schema.sql` no SQL Editor
3. Ativar Auth por e-mail (Authentication → Providers → Email)
4. Preencher `.env` local e Environment Variables na Vercel
5. `npm i @supabase/supabase-js`

**Aceite:** tabelas `profiles`, `signals`, `push_subscriptions` criadas com RLS;
signup/login de teste funciona via supabase-js no console.

---

## Fase 3 — Backend /api (receber sinais do MT4) ✦ (45 min)
**Objetivo:** finalizar as Functions do esqueleto em `/api`.
1. `api/health.js` → já pronto (validar)
2. `api/signals.js` → completar:
   - `POST` com header `x-mt4-token == process.env.MT4_TOKEN` → insere em `signals`
   - Validar payload: asset ∈ 5 ativos, tf ∈ {M5,M15,H1}, dir ∈ {Compra,Venda}
   - `GET` autenticado (JWT Supabase) → retorna sinais filtrados pelas preferências
     do usuário (ativos, timeframes, janela de horário) e cota do plano
3. `api/stats.js` → assertividade, ganhos, perdas, acumulado (a partir de `signals.result_pips`)
4. Testar com curl (exemplos no PROMPTS.md)

**Aceite:** `curl POST /api/signals` com token grava no banco; sem token → 401;
payload inválido → 400; `GET /api/signals` respeita plano/janela/ativos.

---

## Fase 4 — Push Notifications ✦ (45 min)
**Objetivo:** sinal novo → notificação no celular.
1. `npm i web-push` e gerar chaves: `npx web-push generate-vapid-keys`
2. Salvar nas env vars (Vercel + .env)
3. Completar `api/push/subscribe.js` (grava subscription do usuário)
4. No frontend: após login, pedir permissão e registrar
   `registration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })`
5. No `POST /api/signals`: após inserir, buscar subscriptions dos usuários elegíveis
   (ativo+tf+janela+cota) e disparar `webpush.sendNotification`

**Aceite:** POST de sinal de teste → notificação chega no Android (Chrome) e
iPhone (PWA instalado, iOS 16.4+); clicar abre o app na tela de sinais.

---

## Fase 5 — Conectar o frontend ✦ (1h)
**Objetivo:** substituir mocks por dados reais.
1. Criar `src/lib/api.js` (fetch com JWT) e `src/lib/supabase.js`
2. Login real na tela 4 (signup/login Supabase) + persistir sessão
3. Salvar preferências (ativos, tfPerAsset, schedule, plano) na tabela `profiles`
4. Feed/Histórico/Desempenho → `GET /api/signals` e `/api/stats`
   (manter mocks como fallback visual se a API falhar)
5. Contador "Sinais hoje" vindo do backend

**Aceite:** criar conta nova → escolher ativos/TFs/horário → dados persistem após
refresh; sinal postado via curl aparece no feed em tempo real (polling 30s ou
Supabase Realtime).

---

## Fase 6 — EA no MT4 ✦ (30 min, parte manual do usuário)
**Objetivo:** MT4 enviando sinais reais.
1. Ajustar `mt4/InfinitySignalsSender.mq4` com a URL de produção e o MT4_TOKEN
2. Usuário compila no MetaEditor e anexa ao gráfico
3. MT4: Ferramentas → Opções → Expert Advisors → permitir WebRequest para a URL

**Aceite:** sinal disparado no MT4 chega ao banco e gera push.

---

## Fase 7 — APK Android ✦ (30 min)
**Caminho A (rápido):** pwabuilder.com → colar URL → baixar APK assinado.
**Caminho B (nativo):**
```bash
npm run build
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap add android && npx cap sync
cd android && ./gradlew assembleDebug   # APK em app/build/outputs/apk/debug
```
**Aceite:** APK instala num Android físico e o app funciona igual ao PWA.

---

## Fase 8 — Lojas (quando decidir publicar)
- **Play Store:** AAB (`./gradlew bundleRelease` ou PWABuilder) → Play Console (US$ 25 única)
- **App Store:** requer Mac → `npx cap add ios` → Xcode → App Store Connect (US$ 99/ano)
- Preparar: política de privacidade (página pública), screenshots, descrição PT-BR
