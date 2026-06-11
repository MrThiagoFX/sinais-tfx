# CLAUDE.md — Infinity Signals

> Este arquivo é lido automaticamente pelo Claude Code. Ele contém todo o contexto
> do projeto, regras de negócio, convenções e o que falta fazer.

## O que é este projeto

**Infinity Signals** — PWA mobile-first de alertas operacionais (sinais de trading)
gerados por um indicador/EA no MT4. O fluxo completo planejado é:

```
MT4 (EA/Indicador) → WebRequest POST → Backend (Vercel Functions + Supabase)
                                            ↓
                              Web Push → PWA no celular do cliente
```

O frontend está **100% pronto** (15 telas, 2 temas, regras de plano implementadas
com dados mockados). O trabalho restante é backend, integração e empacotamento.

## Stack

- **Frontend:** React 18 + Vite 5, CSS inline (sem Tailwind), PWA (manifest + sw.js)
- **Backend (a finalizar):** Vercel Functions (pasta `/api`) + Supabase
- **Push:** Web Push API com chaves VAPID (sw.js já trata `push` e `notificationclick`)
- **APK:** Capacitor já configurado (`capacitor.config.json`) ou PWABuilder
- **Idioma do produto:** Português do Brasil (manter em TODOS os textos)

## Comandos

```bash
npm install          # instalar dependências
npm run dev          # dev server (localhost:5173)
npm run build        # build de produção (gera /dist)
vercel --prod        # deploy produção (após vercel login)
```

## Estrutura

```
src/App.jsx          # App completo: 15 telas, temas, regras — NÃO reescrever do zero
public/sw.js         # Service worker: cache + push (pronto, só conectar)
public/manifest.json # PWA manifest (pronto)
api/                 # Vercel Functions — esqueleto criado, FINALIZAR
supabase/schema.sql  # Schema do banco — rodar no SQL Editor do Supabase
mt4/                 # EA exemplo que envia sinais via WebRequest
ROADMAP.md           # Fases do projeto com critérios de aceite
PROMPTS.md           # Prompts prontos por fase
.env.example         # Variáveis necessárias
```

## Regras de negócio (JÁ implementadas no frontend — replicar no backend)

### Ativos suportados (somente estes 5)
`EURUSD, GBPUSD, XAUUSD, NAS100, US30`

### Timeframes suportados (somente estes 3)
`M5, M15, H1`

### Regra de timeframes por ativo
- Usuário com **até 3 ativos** selecionados → pode escolher **até 3 timeframes por ativo**
- Usuário com **mais de 3 ativos** → apenas **1 timeframe por ativo**

### Planos e cotas diárias de sinais
| Plano          | Preço      | Cota                                              |
|----------------|------------|---------------------------------------------------|
| Free           | Grátis     | 4 sinais ALEATÓRIOS/dia (não escolhe ativos)      |
| Premium Mensal | R$ 99/mês  | 4 sinais por ativo × timeframe, teto de 20/dia    |
| Premium Anual  | R$ 79/mês* | Igual ao mensal + opção "dia todo" desbloqueada   |

*equivalente, cobrado anualmente.

Fórmula da cota (já em `dailyQuota()` no App.jsx):
`free=4 · premium = min(20, Σ por ativo (4 × qtde de timeframes do ativo))`

### Horário de sinais (janela do cliente)
- Todos os planos configuram janela início/fim (ex.: 08:00–18:00) no Perfil
- Sinais só são entregues DENTRO da janela
- O HISTÓRICO contabiliza somente operações dentro da janela
- **Exclusivo do Anual:** toggle "Dia todo" (recebe 24h) — ou pode delimitar

### Feed de sinais
- Premium: mostra apenas sinais dos ativos+timeframes salvos pelo usuário
- Free: sinais aleatórios (ignora seleção), máx. 4/dia

## Convenções de UI (NÃO quebrar)

- `activeText`: cor do texto sobre o accent — `#2F3741` no tema escuro,
  `#FFFFFF` no claro (evita texto branco estourado sobre verde neon)
- Tema escuro: fundo `#05070A`, accent verde `#C6FF00`
- Tema claro: fundo `#F4F8FC`, accent azul `#2196D9`
- Fonte: `-apple-system, BlinkMacSystemFont, Segoe UI, Arial, Helvetica, sans-serif`
  (pilha segura — resolve acentos/cedilha)
- Ícones de ativos: bandeiras SVG sobrepostas estilo TradingView (componente `AssetIcon`)
- Logo: raio SVG (componente `BoltLogo`)
- App detecta mobile (<520px) → renderiza tela cheia; desktop → frame de demo + painel dev

## Variáveis de ambiente (ver .env.example)

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
MT4_TOKEN            # token simples que o EA envia no header x-mt4-token
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY  # expostas ao front
```

## O que fazer / não fazer

**FAZER:**
- Seguir o ROADMAP.md fase por fase, validando cada critério de aceite
- Manter todos os textos em PT-BR
- Substituir os mocks (`SIGNALS_DATA`, `HISTORY_DATA`) por fetch ao backend SOMENTE
  na Fase 5, mantendo fallback para os mocks se a API falhar
- Pedir confirmação ao usuário antes de qualquer ação que envolva conta/custo
  (login Vercel, criar projeto Supabase, taxas de loja)

**NÃO FAZER:**
- Não reescrever o App.jsx do zero — evoluir o existente
- Não adicionar timeframes ou ativos além dos listados
- Não reintroduzir o conceito de "força mínima" nos filtros (não existe no indicador)
- Não usar localStorage para dados críticos de plano/cota (fonte da verdade = backend)
