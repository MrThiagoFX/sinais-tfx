# ⚡ Infinity Signals — App de Sinais (PWA)

App mobile-first de alertas operacionais (Forex, índices e metais) gerados pelo MT4.
Roda 100% online pela **Vercel**, instala no celular como app (**PWA**) e está
estruturado para gerar **APK** e publicar nas lojas depois.

---

## 🚀 1. Rodar localmente

```bash
npm install
npm run dev
# abre em http://localhost:5173
```

No celular (mesma rede Wi-Fi): `npm run dev -- --host` e acesse o IP mostrado.

---

## 🌐 2. Publicar na Vercel (gratuito)

**Opção A — pelo site (mais fácil):**
1. Suba esta pasta para um repositório no GitHub
2. Acesse vercel.com → Add New Project → importe o repositório
3. Framework: **Vite** (detectado automático) → Deploy
4. Pronto: `https://infinity-signals.vercel.app` (ou seu domínio próprio)

**Opção B — pelo terminal:**
```bash
npm i -g vercel
vercel          # primeiro deploy (preview)
vercel --prod   # produção
```

---

## 📱 3. Instalar no celular SEM loja de aplicativos (PWA)

O app já tem `manifest.json` + `sw.js` configurados.

**Android (Chrome):** abra a URL da Vercel → menu ⋮ → **"Instalar aplicativo"**
ou aceite o banner automático. Vira ícone na tela inicial, abre em tela cheia.

**iPhone (Safari):** abra a URL → botão Compartilhar →
**"Adicionar à Tela de Início"**. Desde o iOS 16.4 o PWA também recebe
**notificações push** — os alertas de sinais funcionam.

O app detecta celular automaticamente: em telas pequenas roda em **tela cheia**
(sem o frame de demonstração); em desktop mostra o simulador + painel dev.

---

## 📦 4. Gerar APK para Android (sem Play Store)

**Opção A — PWABuilder (sem código, ~5 min):**
1. Acesse https://www.pwabuilder.com
2. Cole a URL do app na Vercel → Start
3. Package for Stores → **Android** → baixe o `.apk`
4. Envie o APK pro cliente (WhatsApp, site, etc.) —
   ele só precisa permitir "instalar de fontes desconhecidas"

**Opção B — Capacitor (app nativo, mesmo código):**
```bash
npm run build
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync
npx cap open android   # abre no Android Studio → Build APK
```
O arquivo `capacitor.config.json` já está pronto
(`appId: app.infinitysignals.mobile`).

---

## 🏪 5. Publicar nas lojas (quando quiser)

- **Google Play:** use o pacote AAB do PWABuilder ou do Capacitor →
  Play Console (taxa única US$ 25)
- **App Store:** `npx cap add ios` → Xcode → App Store Connect
  (conta Apple Developer US$ 99/ano)

---

## 🔔 6. Conectar os sinais reais (próxima etapa)

Fluxo planejado: `MT4/EA → WebRequest → Backend → Push → App`

- O `sw.js` já trata eventos **push** e **notificationclick**
- Backend sugerido: **Vercel Functions** (pasta `/api`) ou **Supabase**
  - `POST /api/signals` — recebe o sinal do MT4
  - Web Push (biblioteca `web-push`, chaves VAPID) dispara a notificação
- Supabase também cobre: login, banco de sinais, histórico e controle de planos

---

## 🗂 Estrutura

```
infinity-signals-app/
├── index.html              # entrada + meta PWA/iOS
├── package.json            # React 18 + Vite 5
├── vite.config.js
├── vercel.json             # SPA rewrite + headers do SW
├── capacitor.config.json   # pronto para gerar APK/iOS
├── public/
│   ├── manifest.json       # nome, cores, ícones, standalone
│   ├── sw.js               # cache offline + push notifications
│   └── icons/              # 192, 512 e 512-maskable (raio ⚡)
└── src/
    ├── main.jsx            # registra o Service Worker
    ├── index.css
    └── App.jsx             # app completo (15 telas, 2 temas, regras de plano)
```

---

## 🤖 Usando com o Claude Code (handoff)

Este projeto está preparado para o Claude Code finalizar tudo:

| Arquivo | Função |
|---|---|
| `CLAUDE.md` | Contexto que o Claude Code lê automaticamente (regras de negócio, convenções, o que falta) |
| `ROADMAP.md` | 8 fases com critérios de aceite |
| `PROMPTS.md` | Prompts prontos para colar, fase por fase |
| `api/` | Esqueleto do backend com validações e TODOs marcados |
| `supabase/schema.sql` | Banco completo (perfis, sinais, push, cota diária, RLS) |
| `mt4/InfinitySignalsSender.mq4` | EA exemplo que envia sinais via WebRequest |
| `.env.example` | Todas as variáveis necessárias |

**Passos:**
1. Instale: `npm install -g @anthropic-ai/claude-code` (docs: https://docs.claude.com/en/docs/claude-code/overview)
2. Abra o terminal **nesta pasta** e rode `claude`
3. Cole o *Prompt inicial* do `PROMPTS.md`
4. Avance fase por fase aprovando cada etapa
