//+------------------------------------------------------------------+
//|  TFX_SENDER_EA.mq4  —  Infinity Signals                          |
//|                                                                  |
//|  Le a memoria (GlobalVariables) gravada pelo indicador           |
//|  TFXINFINITY e envia os sinais (abertura/fechamento) para o      |
//|  backend via WebRequest. Roda sozinho num grafico VAZIO, NAO     |
//|  abre ordens, NAO altera o grafico, NAO atrapalha outros robos.  |
//|                                                                  |
//|  AUTO-DESCOBERTA: acha sozinho todos os simbolos/timeframes que  |
//|  o TFXINFINITY estiver gerando — sem precisar configurar nada.   |
//|                                                                  |
//|  PASSOS NA VPS:                                                  |
//|   1) Compile (F7) e arraste este EA num grafico VAZIO qualquer.  |
//|   2) Ligue o AutoTrading (botao no topo do MT4).                 |
//|   3) Ferramentas > Opcoes > Expert Advisors >                    |
//|        [x] Permitir WebRequest para as URLs listadas             |
//|        adicione:  https://sinais-tfx.vercel.app                  |
//+------------------------------------------------------------------+
#property strict
#property version "1.10"
#property description "Envia os sinais do TFXINFINITY para o app Infinity Signals (com dupla conferencia de fechamento)."

// v1.10 — DUPLA CONFERENCIA: alem de obedecer o fechamento marcado pelo
// indicador, o EA confere o PRECO AO VIVO de cada operacao aberta contra o
// TP/SL e fecha sozinho quando o preco cruza. Assim nenhuma operacao fica
// pendurada se o indicador perder o evento de fechamento.

input string ServidorUrl       = "https://sinais-tfx.vercel.app/api/signals";
input string Token             = "0393df6d014741badd6a55f12b62f69627168dabf17f60dd63af1fa9fdd9cebf";
input string NomeDoIndicador   = "TFXINFINITY"; // deve casar com o input do indicador
input int    IntervaloSegundos = 5;             // frequencia de verificacao
input int    TimeoutMs         = 5000;
input bool   MostrarStatus     = true;

string g_sent[];          // marcas "OPEN:id" / "CLOSE:id" ja enviadas
int    g_totalEnviados = 0;
string g_ultimaAcao    = "iniciando...";
string g_ultimoErro    = "";

//+------------------------------------------------------------------+
string Contexto()
{
   string c = NomeDoIndicador;
   StringReplace(c, " ", "");
   StringReplace(c, ".", "");
   StringReplace(c, "_", "");
   if(StringLen(c) == 0) c = "PADRAO";
   return(c);
}

string Tf(int periodo)
{
   if(periodo == 1)    return("M1");
   if(periodo == 5)    return("M5");
   if(periodo == 15)   return("M15");
   if(periodo == 30)   return("M30");
   if(periodo == 60)   return("H1");
   if(periodo == 240)  return("H4");
   if(periodo == 1440) return("D1");
   return(IntegerToString(periodo));
}
string DirTexto(int d)    { return(d > 0 ? "BUY" : (d < 0 ? "SELL" : "NONE")); }
string MotivoTexto(int m) { if(m==1) return("TP"); if(m==2) return("STOP"); if(m==3) return("TRAVA"); return("ABERTO"); }
string Num(double v)      { return(DoubleToString(v, 5)); }

string Sanitiza(string s)
{
   string r = s;
   for(int i = 0; i < StringLen(r); i++)
   {
      ushort c = StringGetCharacter(r, i);
      bool ok = (c>='0'&&c<='9') || (c>='A'&&c<='Z') || (c>='a'&&c<='z');
      if(!ok) StringSetCharacter(r, i, '_');
   }
   return(r);
}

int UltimoIndice(string s, string ch)
{
   int idx = -1, p = 0;
   while(true) { int f = StringFind(s, ch, p); if(f < 0) break; idx = f; p = f + 1; }
   return(idx);
}

double Ler(string base, string campo)
{
   string k = base + campo;
   if(!GlobalVariableCheck(k)) return(0);
   return(GlobalVariableGet(k));
}

bool JaEnviado(string chave)
{
   for(int i = 0; i < ArraySize(g_sent); i++) if(g_sent[i] == chave) return(true);
   return(false);
}
void Marcar(string chave)
{
   int n = ArraySize(g_sent);
   ArrayResize(g_sent, n + 1);
   g_sent[n] = chave;
}

//+------------------------------------------------------------------+
bool Post(string json)
{
   char data[]; char result[]; string rh = "";
   string headers = "Content-Type: application/json\r\nX-TFX-Token: " + Token + "\r\n";
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   int sz = ArraySize(data); if(sz > 0) ArrayResize(data, sz - 1); // remove o \0 final

   ResetLastError();
   int status = WebRequest("POST", ServidorUrl, headers, TimeoutMs, data, result, rh);
   if(status == -1)
   {
      int err = GetLastError();
      g_ultimoErro = "WebRequest erro " + IntegerToString(err) + " — libere a URL nas Opcoes do MT4";
      return(false);
   }
   if(status < 200 || status >= 300)
   {
      g_ultimoErro = "HTTP " + IntegerToString(status);
      return(false);
   }
   g_ultimoErro = "";
   return(true);
}

string JsonAbertura(string id, string symbol, string tf, int dir, double entry, double stop, double target)
{
   string j = "{";
   j += "\"event\":\"SIGNAL_OPEN\",";
   j += "\"signal_id\":\"" + id + "\",";
   j += "\"product\":\"TFXINFINITY\",";
   j += "\"symbol\":\"" + symbol + "\",";
   j += "\"timeframe\":\"" + tf + "\",";
   j += "\"direction\":\"" + DirTexto(dir) + "\",";
   j += "\"entry\":" + Num(entry) + ",";
   j += "\"stop\":" + Num(stop) + ",";
   j += "\"target\":" + Num(target);
   j += "}";
   return(j);
}
string JsonFechamento(string id, string symbol, string tf, int dir, double entry, double exit, int mot)
{
   string j = "{";
   j += "\"event\":\"SIGNAL_CLOSE\",";
   j += "\"signal_id\":\"" + id + "\",";
   j += "\"product\":\"TFXINFINITY\",";
   j += "\"symbol\":\"" + symbol + "\",";
   j += "\"timeframe\":\"" + tf + "\",";
   j += "\"direction\":\"" + DirTexto(dir) + "\",";
   j += "\"entry\":" + Num(entry) + ",";
   j += "\"exit\":" + Num(exit) + ",";
   j += "\"close_reason\":\"" + MotivoTexto(mot) + "\"";
   j += "}";
   return(j);
}

//+------------------------------------------------------------------+
void Varrer()
{
   string pref = "TFXI_" + Contexto() + "_";   // ex.: TFXI_TFXINFINITY_
   int total = GlobalVariablesTotal();
   int setups = 0;
   int pendentes = 0;   // abertas que ainda nao bateram TP/SL

   for(int i = 0; i < total; i++)
   {
      string nome = GlobalVariableName(i);
      if(StringFind(nome, pref) != 0) continue;
      int len = StringLen(nome);
      if(len < 4 || StringSubstr(nome, len - 4) != "_sig") continue;  // ancora no campo _sig

      string base  = StringSubstr(nome, 0, len - 3); // remove "sig", mantem o "_" final
      // miolo = "<symbol>_<period>_<slot>"
      int pInicio  = StringLen(pref);
      string miolo = StringSubstr(base, pInicio, StringLen(base) - pInicio - 1);

      int iSlot = UltimoIndice(miolo, "_");
      if(iSlot < 0) continue;
      string slotStr = StringSubstr(miolo, iSlot + 1);
      string semSlot = StringSubstr(miolo, 0, iSlot);
      int iPer = UltimoIndice(semSlot, "_");
      if(iPer < 0) continue;
      string perStr  = StringSubstr(semSlot, iPer + 1);
      string symbol  = StringSubstr(semSlot, 0, iPer);
      int periodo    = (int)StringToInteger(perStr);

      datetime sig   = (datetime)Ler(base, "sig");
      int      dir   = (int)Ler(base, "dir");
      double   entry = Ler(base, "entry");
      double   stop  = Ler(base, "stop");
      double   target= Ler(base, "target");
      datetime exitT = (datetime)Ler(base, "exitT");
      int      mot   = (int)Ler(base, "mot");
      double   exitP = Ler(base, "exitP");

      // setup valido?
      if(sig <= 0 || dir == 0 || entry <= 0 || stop <= 0) continue;
      setups++;

      string tf = Tf(periodo);
      string id = Sanitiza(symbol) + "_" + tf + "_" + DirTexto(dir) + "_" + IntegerToString((int)sig);
      bool fechado = (exitT > 0 && mot > 0);

      // 1) Abertura (sempre garante que foi enviada)
      if(target > 0 && !JaEnviado("OPEN:" + id))
      {
         if(Post(JsonAbertura(id, symbol, tf, dir, entry, stop, target)))
         {
            Marcar("OPEN:" + id);
            g_totalEnviados++;
            g_ultimaAcao = "ABERTURA " + symbol + " " + tf + " " + DirTexto(dir);
         }
      }

      // 2) Fechamento PRIMARIO — o indicador marcou (exitT/mot).
      if(fechado && JaEnviado("OPEN:" + id) && !JaEnviado("CLOSE:" + id))
      {
         if(Post(JsonFechamento(id, symbol, tf, dir, entry, exitP, mot)))
         {
            Marcar("CLOSE:" + id);
            g_totalEnviados++;
            g_ultimaAcao = "FECHAMENTO " + symbol + " " + tf + " (" + MotivoTexto(mot) + ")";
         }
      }
      // 2b) DUPLA CONFERENCIA — o indicador NAO marcou, mas o preco ja cruzou
      //     o TP/SL: o EA fecha sozinho (nada fica pendurado).
      else if(!fechado && target > 0 && JaEnviado("OPEN:" + id) && !JaEnviado("CLOSE:" + id))
      {
         double preco = MarketInfo(symbol, MODE_BID);
         int    motAuto = 0; double exitAuto = 0;
         if(preco > 0)
         {
            if(dir > 0) {           // BUY
               if(preco >= target)      { motAuto = 1; exitAuto = target; }  // TP
               else if(preco <= stop)   { motAuto = 2; exitAuto = stop;   }  // STOP
            } else {                // SELL
               if(preco <= target)      { motAuto = 1; exitAuto = target; }  // TP
               else if(preco >= stop)   { motAuto = 2; exitAuto = stop;   }  // STOP
            }
         }
         if(motAuto > 0)
         {
            if(Post(JsonFechamento(id, symbol, tf, dir, entry, exitAuto, motAuto)))
            {
               Marcar("CLOSE:" + id);
               g_totalEnviados++;
               g_ultimaAcao = "AUTO-FECHAMENTO " + symbol + " " + tf + " (" + MotivoTexto(motAuto) + ")";
            }
         }
         else pendentes++;   // realmente aberta (preco ainda entre TP e SL, ou indisponivel)
      }
   }

   if(MostrarStatus)
   {
      string s = "TFX SENDER — Infinity Signals (v1.10 dupla conferencia)\n";
      s += "Indicador: " + NomeDoIndicador + "  |  setups: " + IntegerToString(setups) + "  |  abertas: " + IntegerToString(pendentes) + "\n";
      s += "Enviados nesta sessao: " + IntegerToString(g_totalEnviados) + "\n";
      s += "Ultima acao: " + g_ultimaAcao + "\n";
      if(StringLen(g_ultimoErro) > 0) s += "ATENCAO: " + g_ultimoErro + "\n";
      else s += "Status: OK (enviando)\n";
      if(setups == 0) s += "(nenhum setup ainda — o TFXINFINITY esta nos graficos?)\n";
      Comment(s);
   }
}

//+------------------------------------------------------------------+
int OnInit()
{
   EventSetTimer(MathMax(1, IntervaloSegundos));
   Varrer();
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(MostrarStatus) Comment("");
}
void OnTimer()
{
   Varrer();
}
//+------------------------------------------------------------------+
