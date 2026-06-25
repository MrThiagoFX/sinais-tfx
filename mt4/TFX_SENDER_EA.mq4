//+------------------------------------------------------------------+
//|  TFX_SENDER_EA.mq4  —  Infinity Signals  (v2.0 auto-reconcilia)   |
//|                                                                  |
//|  Le a memoria (GlobalVariables) gravada pelo indicador           |
//|  TFXINFINITY e envia os sinais (abertura/fechamento) para o      |
//|  backend via WebRequest. Roda sozinho num grafico VAZIO, NAO     |
//|  abre ordens, NAO altera o grafico, NAO atrapalha outros robos.  |
//|                                                                  |
//|  PASSOS NA VPS:                                                  |
//|   1) Compile (F7) e arraste este EA num grafico VAZIO qualquer.  |
//|   2) Ligue o AutoTrading (botao no topo do MT4).                 |
//|   3) Ferramentas > Opcoes > Expert Advisors >                    |
//|        [x] Permitir WebRequest para as URLs listadas             |
//|        adicione:  https://sinais-tfx.vercel.app                  |
//|   4) Ferramentas > Opcoes > Expert Advisors >                    |
//|        [x] Permitir importacao de DLL  NAO e necessario.         |
//+------------------------------------------------------------------+
#property strict
#property version "2.00"
#property description "Envia sinais do TFXINFINITY com TRIPLA garantia de fechamento: indicador + preco ao vivo + varredura do historico de barras. Memoria em disco (sobrevive a reinicio)."

// ── v2.0 — O QUE MUDOU (resolve operacoes 'penduradas') ───────────
// 1) MEMORIA EM DISCO: o EA grava o que abriu num arquivo
//    (MQL4/Files/tfx_sender_state.csv). Reiniciar o MT4/VPS NAO apaga
//    mais o que estava aberto -> ele continua cuidando de fechar.
// 2) VARREDURA DE HISTORICO: a cada ciclo, para cada operacao aberta,
//    o EA varre as BARRAS desde a entrada (iHigh/iLow) e detecta se
//    bateu TP ou STOP primeiro -> fecha com o RESULTADO REAL, mesmo
//    que o indicador tenha perdido o evento ou o EA tenha ficado fora.
// 3) RETRY ETERNO: so para de cuidar de uma operacao quando o backend
//    confirma o fechamento (HTTP 2xx). Nada fica pendurado.

input string ServidorUrl       = "https://sinais-tfx.vercel.app/api/signals";
input string Token             = "0393df6d014741badd6a55f12b62f69627168dabf17f60dd63af1fa9fdd9cebf";
input string NomeDoIndicador   = "TFXINFINITY"; // deve casar com o input do indicador
input int    IntervaloSegundos = 5;             // frequencia de verificacao
input int    TimeoutMs         = 5000;
input bool   MostrarStatus     = true;

string g_stateFile = "tfx_sender_state.csv";

// ── Estado persistente: operacoes que o EA ja ABRIU ──
// state: "OPEN" = aberta (vigiando p/ fechar) | "DONE" = ja fechada (confirmada)
string   st_id[];     string st_sym[];   int    st_per[];   int    st_dir[];
double   st_entry[];  double st_stop[];  double st_target[];
datetime st_sig[];    string st_state[];

int    g_totalEnviados = 0;
string g_ultimaAcao    = "iniciando...";
string g_ultimoErro    = "";

//+------------------------------------------------------------------+
string Contexto()
{
   string c = NomeDoIndicador;
   StringReplace(c, " ", ""); StringReplace(c, ".", ""); StringReplace(c, "_", "");
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

//+------------------------------------------------------------------+
//|  ESTADO EM DISCO                                                 |
//+------------------------------------------------------------------+
int FindState(string id)
{
   for(int i = 0; i < ArraySize(st_id); i++) if(st_id[i] == id) return(i);
   return(-1);
}

void AddState(string id, string sym, int per, int dir, double entry, double stop, double target, datetime sig, string state)
{
   int n = ArraySize(st_id);
   ArrayResize(st_id, n+1);    ArrayResize(st_sym, n+1);    ArrayResize(st_per, n+1);
   ArrayResize(st_dir, n+1);   ArrayResize(st_entry, n+1);  ArrayResize(st_stop, n+1);
   ArrayResize(st_target, n+1);ArrayResize(st_sig, n+1);    ArrayResize(st_state, n+1);
   st_id[n]=id; st_sym[n]=sym; st_per[n]=per; st_dir[n]=dir; st_entry[n]=entry;
   st_stop[n]=stop; st_target[n]=target; st_sig[n]=sig; st_state[n]=state;
}

// Reescreve o arquivo inteiro a partir dos arrays; poda DONE com +7 dias.
void SaveState()
{
   int h = FileOpen(g_stateFile, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE) { g_ultimoErro = "nao gravou estado (FileOpen)"; return; }
   datetime corte = TimeCurrent() - 7*24*3600;
   for(int i = 0; i < ArraySize(st_id); i++)
   {
      if(st_state[i] == "DONE" && st_sig[i] < corte) continue; // poda antigas
      string line = st_id[i] + ";" + st_sym[i] + ";" + IntegerToString(st_per[i]) + ";"
                  + IntegerToString(st_dir[i]) + ";" + Num(st_entry[i]) + ";" + Num(st_stop[i]) + ";"
                  + Num(st_target[i]) + ";" + IntegerToString((int)st_sig[i]) + ";" + st_state[i];
      FileWriteString(h, line + "\r\n");
   }
   FileClose(h);
}

void LoadState()
{
   ArrayResize(st_id,0); ArrayResize(st_sym,0); ArrayResize(st_per,0); ArrayResize(st_dir,0);
   ArrayResize(st_entry,0); ArrayResize(st_stop,0); ArrayResize(st_target,0);
   ArrayResize(st_sig,0); ArrayResize(st_state,0);
   if(!FileIsExist(g_stateFile)) return;
   int h = FileOpen(g_stateFile, FILE_READ|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE) return;
   while(!FileIsEnding(h))
   {
      string line = FileReadString(h);
      if(StringLen(line) < 5) continue;
      string p[]; int n = StringSplit(line, ';', p);
      if(n < 9) continue;
      AddState(p[0], p[1], (int)StringToInteger(p[2]), (int)StringToInteger(p[3]),
               StringToDouble(p[4]), StringToDouble(p[5]), StringToDouble(p[6]),
               (datetime)StringToInteger(p[7]), p[8]);
   }
   FileClose(h);
}

//+------------------------------------------------------------------+
//|  ENVIO HTTP                                                      |
//+------------------------------------------------------------------+
bool Post(string json)
{
   char data[]; char result[]; string rh = "";
   string headers = "Content-Type: application/json\r\nX-TFX-Token: " + Token + "\r\n";
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   int sz = ArraySize(data); if(sz > 0) ArrayResize(data, sz - 1);
   ResetLastError();
   int status = WebRequest("POST", ServidorUrl, headers, TimeoutMs, data, result, rh);
   if(status == -1) { g_ultimoErro = "WebRequest erro " + IntegerToString(GetLastError()) + " — libere a URL nas Opcoes"; return(false); }
   if(status < 200 || status >= 300) { g_ultimoErro = "HTTP " + IntegerToString(status); return(false); }
   g_ultimoErro = "";
   return(true);
}
string JsonAbertura(string id, string symbol, string tf, int dir, double entry, double stop, double target)
{
   return("{\"event\":\"SIGNAL_OPEN\",\"signal_id\":\"" + id + "\",\"product\":\"TFXINFINITY\",\"symbol\":\""
        + symbol + "\",\"timeframe\":\"" + tf + "\",\"direction\":\"" + DirTexto(dir) + "\",\"entry\":"
        + Num(entry) + ",\"stop\":" + Num(stop) + ",\"target\":" + Num(target) + "}");
}
string JsonFechamento(string id, string symbol, string tf, int dir, double entry, double exit, int mot)
{
   return("{\"event\":\"SIGNAL_CLOSE\",\"signal_id\":\"" + id + "\",\"product\":\"TFXINFINITY\",\"symbol\":\""
        + symbol + "\",\"timeframe\":\"" + tf + "\",\"direction\":\"" + DirTexto(dir) + "\",\"entry\":"
        + Num(entry) + ",\"exit\":" + Num(exit) + ",\"close_reason\":\"" + MotivoTexto(mot) + "\"}");
}

//+------------------------------------------------------------------+
//|  VARREDURA DE HISTORICO — bateu TP ou STOP primeiro?            |
//|  retorna 1=TP, 2=STOP, 0=ainda rodando.  exitOut = preco saida. |
//+------------------------------------------------------------------+
int CheckHistory(string sym, int per, int dir, double stop, double target, datetime sig, double &exitOut)
{
   SymbolSelect(sym, true);                       // garante dados do simbolo
   int shift = iBarShift(sym, per, sig, false);   // barra que cobre a entrada
   if(shift < 0) return(0);
   // varre do mais antigo (shift) ao mais novo (0)
   for(int i = shift; i >= 0; i--)
   {
      double hi = iHigh(sym, per, i);
      double lo = iLow(sym, per, i);
      if(hi <= 0 || lo <= 0) continue;
      if(dir > 0) // BUY: TP acima, STOP abaixo
      {
         bool tp = (hi >= target), sl = (lo <= stop);
         if(tp && sl) { exitOut = stop;   return(2); } // ambiguo intrabar -> conservador (STOP)
         if(tp)       { exitOut = target; return(1); }
         if(sl)       { exitOut = stop;   return(2); }
      }
      else // SELL: TP abaixo, STOP acima
      {
         bool tp = (lo <= target), sl = (hi >= stop);
         if(tp && sl) { exitOut = stop;   return(2); }
         if(tp)       { exitOut = target; return(1); }
         if(sl)       { exitOut = stop;   return(2); }
      }
   }
   return(0);
}

//+------------------------------------------------------------------+
void Varrer()
{
   bool mudou = false;
   string pref = "TFXI_" + Contexto() + "_";
   int total = GlobalVariablesTotal();
   int setups = 0;

   // ── FASE A: descobrir setups no indicador → ABRIR + fechamento PRIMARIO ──
   for(int i = 0; i < total; i++)
   {
      string nome = GlobalVariableName(i);
      if(StringFind(nome, pref) != 0) continue;
      int len = StringLen(nome);
      if(len < 4 || StringSubstr(nome, len - 4) != "_sig") continue;

      string base  = StringSubstr(nome, 0, len - 3);
      int pInicio  = StringLen(pref);
      string miolo = StringSubstr(base, pInicio, StringLen(base) - pInicio - 1);
      int iSlot = UltimoIndice(miolo, "_"); if(iSlot < 0) continue;
      string semSlot = StringSubstr(miolo, 0, iSlot);
      int iPer = UltimoIndice(semSlot, "_"); if(iPer < 0) continue;
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

      if(sig <= 0 || dir == 0 || entry <= 0 || stop <= 0 || target <= 0) continue;
      setups++;

      string tf = Tf(periodo);
      string id = Sanitiza(symbol) + "_" + tf + "_" + DirTexto(dir) + "_" + IntegerToString((int)sig);
      bool fechado = (exitT > 0 && mot > 0);
      int idx = FindState(id);

      if(idx < 0)
      {
         // setup novo: so abre se ainda estiver RODANDO (nao backfilla antigas
         // ja fechadas -> evitaria datar errado no banco).
         if(!fechado)
         {
            if(Post(JsonAbertura(id, symbol, tf, dir, entry, stop, target)))
            {
               AddState(id, symbol, periodo, dir, entry, stop, target, sig, "OPEN");
               g_totalEnviados++; mudou = true;
               g_ultimaAcao = "ABERTURA " + symbol + " " + tf + " " + DirTexto(dir);
            }
         }
      }
      else if(st_state[idx] == "OPEN" && fechado)
      {
         // fechamento PRIMARIO (indicador marcou)
         if(Post(JsonFechamento(id, symbol, tf, dir, entry, exitP, mot)))
         {
            st_state[idx] = "DONE";
            g_totalEnviados++; mudou = true;
            g_ultimaAcao = "FECHAMENTO " + symbol + " " + tf + " (" + MotivoTexto(mot) + ")";
         }
      }
   }

   // ── FASE B: RECONCILIACAO — para CADA aberta conhecida (mesmo que o
   //    indicador tenha perdido o slot), varre o historico e fecha. ──
   int abertas = 0;
   for(int j = 0; j < ArraySize(st_id); j++)
   {
      if(st_state[j] != "OPEN") continue;
      double exitR = 0;
      int r = CheckHistory(st_sym[j], st_per[j], st_dir[j], st_stop[j], st_target[j], st_sig[j], exitR);
      if(r > 0)
      {
         string tf = Tf(st_per[j]);
         if(Post(JsonFechamento(st_id[j], st_sym[j], tf, st_dir[j], st_entry[j], exitR, r)))
         {
            st_state[j] = "DONE";
            g_totalEnviados++; mudou = true;
            g_ultimaAcao = "RECONCILIADO " + st_sym[j] + " " + tf + " (" + MotivoTexto(r) + ")";
         }
      }
      else abertas++;
   }

   if(mudou) SaveState();

   if(MostrarStatus)
   {
      string s = "TFX SENDER — Infinity Signals (v2.0 auto-reconcilia)\n";
      s += "Indicador: " + NomeDoIndicador + "  |  setups: " + IntegerToString(setups) + "  |  abertas vigiadas: " + IntegerToString(abertas) + "\n";
      s += "Em memoria (disco): " + IntegerToString(ArraySize(st_id)) + "  |  enviados nesta sessao: " + IntegerToString(g_totalEnviados) + "\n";
      s += "Ultima acao: " + g_ultimaAcao + "\n";
      if(StringLen(g_ultimoErro) > 0) s += "ATENCAO: " + g_ultimoErro + "\n"; else s += "Status: OK (vigiando + reconciliando)\n";
      if(setups == 0 && ArraySize(st_id) == 0) s += "(nenhum setup ainda — o TFXINFINITY esta nos graficos?)\n";
      Comment(s);
   }
}

//+------------------------------------------------------------------+
int OnInit()
{
   LoadState();                                   // recupera o que estava aberto
   EventSetTimer(MathMax(1, IntervaloSegundos));
   Varrer();
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason) { EventKillTimer(); if(MostrarStatus) Comment(""); }
void OnTimer() { Varrer(); }
//+------------------------------------------------------------------+
