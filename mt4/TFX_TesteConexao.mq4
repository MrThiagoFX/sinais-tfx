//+------------------------------------------------------------------+
//|  TFX_TesteConexao.mq4  —  Diagnóstico de WebRequest              |
//|  NAO é um sender. Roda UMA vez e escreve no log Especialistas    |
//|  o resultado EXATO da conexao com o servidor. Serve so p/ achar  |
//|  o motivo do erro 5203.                                          |
//|                                                                  |
//|  USO: MetaEditor -> abre este arquivo -> Compilar (F7).          |
//|  No MT4: Navegador -> Scripts -> arrasta TFX_TesteConexao num    |
//|  grafico. Depois abra a aba "Especialistas" e leia as linhas.    |
//+------------------------------------------------------------------+
#property strict
#property show_inputs

input string Url   = "https://sinais-tfx.vercel.app";
input string Token = "0393df6d014741badd6a55f12b62f69627168dabf17f60dd63af1fa9fdd9cebf";

void Testa(string metodo, string url, string corpo)
{
   char data[]; char result[]; string rh = "";
   string headers = "Content-Type: application/json\r\nX-TFX-Token: " + Token + "\r\n";
   if(StringLen(corpo) > 0)
   {
      StringToCharArray(corpo, data, 0, WHOLE_ARRAY, CP_UTF8);
      int sz = ArraySize(data); if(sz > 0) ArrayResize(data, sz - 1);
   }
   ResetLastError();
   int st = WebRequest(metodo, url, headers, 8000, data, result, rh);
   int err = GetLastError();
   if(st == -1)
      Print(">> ", metodo, " ", url, "  ->  FALHOU  GetLastError=", err,
            "   (4014/4060 = URL nao liberada | 5203 = request falhou | 5201 = sem conexao | 5202 = timeout | 5200 = URL invalida)");
   else
      Print(">> ", metodo, " ", url, "  ->  OK!  HTTP=", st,
            "   resposta=", StringSubstr(CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8), 0, 100));
}

void OnStart()
{
   Print("===== TFX TESTE DE CONEXAO — inicio =====");
   Testa("GET",  Url + "/api/health",  "");    // so testa a conexao (sem token)
   Testa("POST", Url + "/api/signals",
         "{\"event\":\"SIGNAL_OPEN\",\"signal_id\":\"DIAG_TESTE_APAGAR\",\"symbol\":\"XAUUSD\",\"timeframe\":\"M15\",\"direction\":\"BUY\",\"entry\":2350,\"stop\":2345,\"target\":2360}");
   Print("===== TFX TESTE DE CONEXAO — fim. Leia as 2 linhas '>>' acima =====");
}
//+------------------------------------------------------------------+
