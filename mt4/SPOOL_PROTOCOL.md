# Protocolo de Spool — Indicador → Sender → Backend

> Documento de contrato entre **3 peças**: o **indicador** (MT4, produz sinais),
> o **sender** (entrega ao backend) e o **backend** (`/api/signals`, já no ar).
> Objetivo: **nunca perder sinal**, mesmo com ~24 gráficos rodando ao mesmo
> tempo (vários ativos × timeframes), aberturas e fechamentos simultâneos.

## Por que assim (e não GlobalVariables)

GlobalVariables é **estado compartilhado mutável**: com muitos gráficos, um sinal
sobrescreve o slot do outro, o sender lê pela metade, ou perde no intervalo do
poll. Trocamos por um **spool de arquivos** (padrão "drop folder"): cada evento é
um arquivo independente. Nada sobrescreve nada; nada some.

```
24 indicadores → cada um faz DROP de 1 arquivo por evento (escrita atômica)
                                   ↓
        sender varre a pasta → POST cada arquivo → 2xx? apaga : mantém (retry)
                                   ↓
                       backend /api/signals (idempotente por signal_id)
```

## As 3 regras de ouro (não quebrar nenhuma)

1. **1 arquivo por evento.** Nunca um arquivo único compartilhado entre gráficos
   (isso recria a disputa/perda). Cada abertura e cada fechamento = seu próprio
   arquivo, com nome único.
2. **Escrita atômica.** O indicador escreve em `*.tmp` e só depois **renomeia**
   para `*.json`. O sender só enxerga `*.json` → nunca lê arquivo pela metade.
3. **Apagar só depois do 2xx.** O sender só remove o arquivo **após** o backend
   confirmar sucesso (HTTP 2xx). Falhou → o arquivo **fica** e é reenviado. Como
   o backend é idempotente (`signal_id`), reenviar **não duplica**.

---

## 1. Pasta (drop folder)

- **Sender é EA (dentro do MT4):** use a pasta local `MQL4/Files/tfx_outbox/`.
- **Sender é externo (PowerShell/Node):** o indicador deve escrever na pasta
  **comum** (flag `FILE_COMMON` no MT4):
  `C:\Users\<user>\AppData\Roaming\MetaQuotes\Terminal\Common\Files\tfx_outbox\`

Recomendado: **pasta comum + sender externo** (mais fácil de debugar: você abre a
pasta e vê os sinais pendentes; os enviados somem).

## 2. Nome do arquivo

```
<signal_id>__<EVENT>.json
```
- `signal_id` = `<SYMBOL>_<TF>_<DIR>_<SIG_EPOCH>` (definido abaixo)
- `EVENT` = `OPEN` ou `CLOSE`

Exemplos:
```
XAUUSD_M5_BUY_1718640000__OPEN.json
XAUUSD_M5_BUY_1718640000__CLOSE.json
US30_H1_SELL_1718640120__OPEN.json
```
A abertura e o fechamento do **mesmo trade** compartilham o `signal_id` (é o que
liga os dois no backend), mas são **arquivos diferentes** (`__OPEN` vs `__CLOSE`).

## 3. Conteúdo do arquivo = corpo do POST (verbatim)

**O arquivo contém exatamente o JSON que o sender vai postar.** O sender é "burro":
lê os bytes e manda como `body` — não precisa entender o schema. Quem é dono do
formato é o indicador.

### Abertura (`__OPEN.json`)
```json
{
  "event": "SIGNAL_OPEN",
  "signal_id": "XAUUSD_M5_BUY_1718640000",
  "product": "TFXINFINITY",
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "direction": "BUY",
  "entry": 2365.40000,
  "stop": 2360.00000,
  "target": 2373.00000
}
```

### Fechamento (`__CLOSE.json`)
```json
{
  "event": "SIGNAL_CLOSE",
  "signal_id": "XAUUSD_M5_BUY_1718640000",
  "product": "TFXINFINITY",
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "direction": "BUY",
  "entry": 2365.40000,
  "exit": 2373.00000,
  "close_reason": "TP"
}
```

### Campos
| Campo | Onde | Valores | Observação |
|---|---|---|---|
| `event` | ambos | `SIGNAL_OPEN` \| `SIGNAL_CLOSE` | |
| `signal_id` | ambos | `<SYMBOL>_<TF>_<DIR>_<SIG_EPOCH>` | **idêntico** na abertura e no fechamento do mesmo trade |
| `symbol` | ambos | `EURUSD` `GBPUSD` `XAUUSD` `NAS100` `US30` | ver normalização abaixo |
| `timeframe` | ambos | `M5` `M15` `H1` | **só esses 3** |
| `direction` | ambos | `BUY` \| `SELL` | |
| `entry` | ambos | número (5 casas) | preço de entrada |
| `stop` | abertura | número | stop loss |
| `target` | abertura | número | take profit |
| `exit` | fechamento | número | preço de saída |
| `close_reason` | fechamento | `TP` \| `STOP` \| `TRAVA` | `STOP` marca **perda**; os outros, o backend decide pelo pips |
| `product` | ambos | `TFXINFINITY` | informativo (backend ignora) |

- **`SIG_EPOCH`** = timestamp (segundos Unix) do momento do sinal — garante nome
  único e estável (o mesmo na abertura e no fechamento).
- **Normalização de símbolo:** o backend já mapeia variações (`XAUUSD.m`→`XAUUSD`,
  `USTEC`/`NDX`/`NAS`→`NAS100`, `DJ30`/`WS30`/`DOW`→`US30`, `GOLD`/`XAU`→`XAUUSD`).
  Símbolo/timeframe fora da lista → o backend responde **200 `skipped`** (é ok,
  veja a tabela de respostas).

---

## 4. Responsabilidades do **INDICADOR** (para o Codex ajustar)

O indicador **não envia HTTP** (no MT4 indicador não pode `WebRequest`). Ele só
**produz arquivos**:

1. Ao **detectar uma entrada** → montar o JSON de abertura e gravar
   `<signal_id>__OPEN.json` na pasta de spool, **de forma atômica**:
   escrever `<signal_id>__OPEN.json.tmp` e depois renomear para `.json`
   (no MT4: `FileWrite` no `.tmp`, `FileClose`, `FileMove` para `.json`).
2. Ao **encerrar** (TP/SL/trava) → montar o JSON de fechamento com o **mesmo
   `signal_id`** e gravar `<signal_id>__CLOSE.json` (também atômico).
3. **Nunca** reabrir/sobrescrever um arquivo já criado. **Nunca** escrever vários
   gráficos no mesmo arquivo. Um evento = um arquivo novo.
4. Se usar sender externo, gravar com `FILE_COMMON` (pasta comum).
5. `signal_id` precisa ser **determinístico e estável**: o mesmo cálculo gera o
   mesmo id se rodar de novo (idempotência depende disso).

> Convenção de `signal_id` já usada hoje no projeto:
> `Sanitiza(symbol) + "_" + TF + "_" + ("BUY"/"SELL") + "_" + SIG_EPOCH`
> (Sanitiza = troca tudo que não for `[A-Za-z0-9]` por `_`.)

## 5. Responsabilidades do **SENDER** (para o Claude do amigo escrever)

Loop a cada N segundos (ex.: 2–5s):

1. Listar `*.json` da pasta de spool (ignorar `*.tmp` — ainda sendo escritos).
   Processar em **ordem de nome/tempo** (aberturas antes dos fechamentos do mesmo
   ciclo, na medida do possível).
2. Para cada arquivo: ler o conteúdo (UTF-8) e **POST** com:
   - URL: `https://sinais-tfx.vercel.app/api/signals`
   - Headers: `Content-Type: application/json`, `X-TFX-Token: <MT4_TOKEN>`
   - Body: o conteúdo do arquivo **verbatim**
3. Tratar a resposta (ver tabela na seção 6):
   - **2xx** → sucesso → **apagar** o arquivo.
   - **400** → payload inválido/permanentemente ruim → **mover para `tfx_outbox/bad/`**
     e logar (não adianta reenviar pra sempre).
   - **401** → token errado (config) → **não apagar**, parar e **alertar** (não fica
     em loop nem perde dado).
   - **429** → respeitar o header `Retry-After`, **manter** o arquivo, tentar depois.
   - **5xx / 503 / erro de rede** → transitório → **manter** o arquivo, retry no
     próximo ciclo.
4. **Idempotência:** reenviar o mesmo arquivo é seguro (o backend dedup por
   `signal_id`; abertura repetida volta `200 {duplicate:true}` → conta como sucesso
   → apaga).
5. **Rate limit:** o backend aceita **120 req/min** globais. Dar um pequeno intervalo
   entre POSTs (ou limitar por ciclo) pra não bater no 429 em rajada.
6. **Log visível:** registrar cada envio (arquivo, status, ação) — é o que torna
   isso fácil de auditar, ao contrário do modelo antigo.

> O `<MT4_TOKEN>` do header **tem que ser igual** à env var `MT4_TOKEN`
> configurada no Vercel (produção). Não versionar esse valor em texto puro.

## 6. Contrato do backend `/api/signals` (referência)

`POST https://sinais-tfx.vercel.app/api/signals` — header `X-TFX-Token`.

| HTTP | Quando | O sender faz |
|---|---|---|
| `201` | abertura gravada | apaga ✔ |
| `200 {ok:true}` | fechamento aplicado | apaga ✔ |
| `200 {duplicate:true}` | abertura já existia (idempotência) | apaga ✔ |
| `200 {skipped:...}` | ativo/timeframe fora do escopo | apaga ✔ (não é erro) |
| `400` | direção inválida / campos faltando | mover p/ `bad/` + log |
| `401` | token errado | parar + alertar (não apaga) |
| `429` | passou de 120/min | respeitar `Retry-After`, manter |
| `5xx` / `503` | erro temporário do servidor | manter + retry |

Regra mental do sender: **qualquer 2xx = apaga. 4xx = problema do payload/auth
(não reenviar cegamente). 5xx/429/rede = manter e tentar de novo.**

## 7. Casos de borda (por que não perde)

- **Sender reinicia:** os arquivos pendentes continuam na pasta → reprocessa.
- **Sender cai no meio do envio:** o arquivo só some após o 2xx → será reenviado
  → idempotência evita duplicar.
- **Indicador escreve enquanto o sender lê:** impossível ler incompleto, por causa
  do `.tmp`→rename atômico (o sender só vê `.json` finalizado).
- **Mesma entrada gerada duas vezes:** mesmo `signal_id` → backend dedup.
- **Fechamento antes da abertura ter ido:** o backend casa pelo `signal_id`; se a
  abertura ainda não foi, o fechamento pode falhar/ficar — processar por ordem de
  tempo minimiza, e o retry resolve quando a abertura subir.

---

### Resumo de uma linha
**Indicador faz drop de 1 arquivo JSON por evento (atômico) → sender posta cada um
e só apaga no 2xx → backend idempotente.** Simples, auditável e sem perda.
