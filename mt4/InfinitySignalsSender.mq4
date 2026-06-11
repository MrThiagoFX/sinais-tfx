//+------------------------------------------------------------------+
//| InfinitySignalsSender.mq4                                        |
//| Envia sinais do indicador/EA para o backend Infinity Signals     |
//| via WebRequest (POST JSON).                                      |
//|                                                                  |
//| CONFIGURAÇÃO OBRIGATÓRIA NO MT4:                                 |
//| Ferramentas → Opções → Expert Advisors →                         |
//|   [x] Permitir WebRequest para as URLs listadas                  |
//|   Adicionar: https://SEU-APP.vercel.app                          |
//+------------------------------------------------------------------+
#property strict

input string BackendURL = "https://SEU-APP.vercel.app/api/signals"; // URL do backend
input string MT4Token   = "troque-por-um-token-longo-aleatorio";    // = env MT4_TOKEN

//+------------------------------------------------------------------+
//| Chame esta função quando o SEU indicador detectar um sinal.      |
//| Exemplo: EnviarSinal("XAUUSD","Compra","M5",2365.40,2360.0,2373) |
//| asset: EURUSD|GBPUSD|XAUUSD|NAS100|US30                          |
//| dir:   Compra|Venda      tf: M5|M15|H1                           |
//+------------------------------------------------------------------+
bool EnviarSinal(string asset, string dir, string tf,
                 double entry, double sl, double tp)
{
   string json = StringFormat(
      "{\"asset\":\"%s\",\"dir\":\"%s\",\"tf\":\"%s\","
      "\"entry\":%.5f,\"sl\":%.5f,\"tp\":%.5f}",
      asset, dir, tf, entry, sl, tp);

   string headers = "Content-Type: application/json\r\n"
                    "x-mt4-token: " + MT4Token + "\r\n";

   char post[]; char result[]; string resultHeaders;
   StringToCharArray(json, post, 0, StringLen(json));

   ResetLastError();
   int status = WebRequest("POST", BackendURL, headers, 5000,
                           post, result, resultHeaders);

   if(status == -1)
   {
      Print("InfinitySignals: WebRequest falhou. Erro ", GetLastError(),
            " — confira se a URL está liberada nas Opções do MT4.");
      return false;
   }

   string body = CharArrayToString(result);
   Print("InfinitySignals: HTTP ", status, " → ", body);
   return (status == 201 || status == 200);
}

//+------------------------------------------------------------------+
//| Exemplo de integração: dispare no cruzamento do SEU indicador.   |
//| Aqui usamos um exemplo didático (cruzamento de médias) apenas    |
//| para demonstrar o ponto de chamada — substitua pela sua lógica   |
//| do TFX Infinity.                                                 |
//+------------------------------------------------------------------+
datetime ultimaBarra = 0;

void OnTick()
{
   if(Time[0] == ultimaBarra) return;   // 1 verificação por barra
   ultimaBarra = Time[0];

   // >>> SUBSTITUA este bloco pela condição real do seu indicador <<<
   double maRapida = iMA(Symbol(), 0, 9,  0, MODE_EMA, PRICE_CLOSE, 1);
   double maLenta  = iMA(Symbol(), 0, 21, 0, MODE_EMA, PRICE_CLOSE, 1);
   double maRapidaAnt = iMA(Symbol(), 0, 9,  0, MODE_EMA, PRICE_CLOSE, 2);
   double maLentaAnt  = iMA(Symbol(), 0, 21, 0, MODE_EMA, PRICE_CLOSE, 2);

   string tf = TimeframeParaTexto(Period());
   if(tf == "") return;                 // só M5/M15/H1 são suportados

   string asset = SimboloParaAsset(Symbol());
   if(asset == "") return;              // só os 5 ativos suportados

   double pt = MarketInfo(Symbol(), MODE_POINT) * 10;

   if(maRapidaAnt <= maLentaAnt && maRapida > maLenta)
      EnviarSinal(asset, "Compra", tf, Ask, Ask - 50*pt, Ask + 80*pt);

   if(maRapidaAnt >= maLentaAnt && maRapida < maLenta)
      EnviarSinal(asset, "Venda", tf, Bid, Bid + 50*pt, Bid - 80*pt);
}

string TimeframeParaTexto(int period)
{
   switch(period)
   {
      case PERIOD_M5:  return "M5";
      case PERIOD_M15: return "M15";
      case PERIOD_H1:  return "H1";
   }
   return "";
}

string SimboloParaAsset(string symbol)
{
   // Normaliza sufixos de corretora (ex.: XAUUSD.m → XAUUSD)
   string aceitos[5] = {"EURUSD","GBPUSD","XAUUSD","NAS100","US30"};
   for(int i = 0; i < 5; i++)
      if(StringFind(symbol, aceitos[i]) == 0) return aceitos[i];
   // Aliases comuns de índices
   if(StringFind(symbol, "NDX")  == 0 || StringFind(symbol, "USTEC") == 0) return "NAS100";
   if(StringFind(symbol, "DJ30") == 0 || StringFind(symbol, "US30")  == 0) return "US30";
   return "";
}
