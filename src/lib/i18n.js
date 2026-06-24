// Internacionalização COMPLETA (i18n) — PT, EN, ES
export const translations = {
  pt: {
    // ─────────────────── NAVEGAÇÃO ───────────────────
    inicio: "Início", sinais: "Sinais", desempenho: "Desempenho", historico: "Histórico", mais: "Mais", voltar: "Voltar",

    // ─────────────────── HOME ───────────────────
    ola: "Olá", dashboard: "Dashboard", bemVindo: "Bem-vindo", operacoesHoje: "Operações hoje",
    ganhos: "Ganhos", perdas: "Perdas", assertividade: "Acerto", pips: "pips", ops: "ops",
    ultimosSinais: "Últimos sinais", todos: "Todos", diaAtivo: "Dia ativo", semanaAtiva: "Semana ativa", mesAtivo: "Mês ativo",
    diaFimDeSemana: "Fim de semana — mercado Forex fechado", naoHaOperacoes: "Não há operações agora",
    operacaoRodando: "Operação rodando — aguardando bater TP ou SL", proximoSinalAbrem: "O próximo sinal só abre quando esta fechar",

    // ─────────────────── SINAIS ───────────────────
    sinaisAtivos: "Sinais ativos", emAndamento: "Em andamento", resultado: "Resultado", avisarAoFechar: "Avisar ao fechar",
    compra: "Compra", venda: "Venda", compras: "Compras", vendas: "Vendas", entrada: "Entrada", alvo: "Alvo", stop: "Stop",
    entradadef: "Entrada", alvoDef: "Alvo", stopDef: "Stop", statusAberto: "aberto", statusGanho: "ganho", statusPerda: "perda",

    // ─────────────────── PERFORMANCE ───────────────────
    curvaDeCapital: "Curva de capital", semana: "Semana", mes: "Mês", geral: "Geral", periodo: "Período",
    semanaLabel: "Esta semana", mesLabel: "Mês", geralLabel: "Geral", desempenhoAtivos: "Desempenho por ativo",
    desempenhoTimeframes: "Desempenho por timeframe", win: "Win", loss: "Loss", rr: "R:R",

    // ─────────────────── HISTÓRICO ───────────────────
    operacoesFechadas: "Operações fechadas", filtrar: "Filtrar", limpar: "Limpar", semResultados: "Sem resultados",
    verMais: "Ver mais", naoHaOperacoes2: "Nenhuma operação até agora",

    // ─────────────────── PERFIL ───────────────────
    perfil: "Meu perfil", meusDados: "Meus dados", preferencias: "Preferências", sair: "Sair", nome: "Nome", email: "E-mail",
    telefone: "Telefone", senha: "Senha", novaSenh: "Nova senha", altarEmail: "Alterar e-mail", alterarSenha: "Alterar senha",
    editarPerfil: "Editar perfil", salvar: "Salvar", cancelar: "Cancelar", fechar: "Fechar",

    // ─────────────────── AJUSTES ───────────────────
    tema: "Tema", claro: "Claro", escuro: "Escuro", idioma: "Idioma", portuguese: "Português", english: "English", spanish: "Español",
    horarioSinais: "Horário de sinais", diaInteiro: "Dia inteiro", horarioFixo: "Horário fixo", inicio: "Início", fim: "Fim",
    janela: "Janela", horario: "Horário", ativos: "Ativos", timeframes: "Timeframes", ativosSelecionados: "Ativos selecionados",
    escolhaAtivos: "Escolha seus ativos", editarAtivos: "Editar ativos e timeframes", escolhaTimeframes: "Escolha timeframes",
    language_desc: "Escolha seu idioma preferido. Auto-salvo.", schedule_saved: "Horário salvo!",

    // ─────────────────── PLANOS ───────────────────
    plan: "Plano", free: "Grátis", mensal: "Mensal", anual: "Anual", aluno: "Aluno", premium: "Premium",
    escolhaPlano: "Escolha seu plano", assinar: "Assinar", cancearPlano: "Cancelar plano", upgrade: "Upgrade",
    operacoesDia: "operações/dia", acesso24: "Acesso 24h", horarioCustomizado: "Horário customizado",

    // ─────────────────── AUTH ───────────────────
    entrar: "Entrar", cadastrar: "Cadastrar", loginComEmail: "Entrar com e-mail", novaConta: "Criar nova conta",
    esqueceuSenha: "Esqueceu a senha?", enviar: "Enviar", redefinir: "Redefinir", confirmar: "Confirmar",
    confirmeSenha: "Confirme a senha", cupom: "Cupom", referencia: "Código de referência", jaTemConta: "Já tem conta?",

    // ─────────────────── ADMIN ───────────────────
    paineladmin: "Painel admin", usuarios: "Usuários", saudeDoSistema: "Saúde do sistema", verificarAgora: "Verificar agora",
    reconstruirLaudo: "Reconstruir laudo", monitoramentoDeErros: "Monitoramento de erros", ultimasfalhas: "Últimas falhas",
    seEstiverVazio: "Se estiver vazio, está tudo rodando sem erros.", limparErros: "Limpar erros", clicNaLinha: "Clique na linha pra ver detalhes",
    operacoesAbertas: "Operações abertas", diagnostico: "Diagnóstico", divergencias: "Divergências", presas: "Presas (>12h)",
    autoResolvidas: "Auto-resolvidas", buckets: "Buckets", fechados: "Fechados", laudoPips: "Laudo pips",

    // ─────────────────── NOTIFICAÇÕES ───────────────────
    notificacoes: "Notificações", centralNotificacoes: "Central de notificações", novasNotificacoes: "Novas notificações",
    sinalAberto: "Sinal aberto", sinalFechado: "Sinal fechado", ganhou: "Ganhou!", perdeu: "Perdeu", tp: "TP", sl: "SL",
    ativarNotificacoes: "Ativar notificações", permitirNotificacoes: "Permitir notificações push",

    // ─────────────────── FAQ ───────────────────
    centralAjuda: "Central de ajuda", perguntas: "Perguntas frequentes", oQueEh: "O que é?", comoFunciona: "Como funciona?",
    leia: "Leia", expandir: "Expandir", colapsar: "Colapsar",

    // ─────────────────── MSGS DE ERRO/SUCESSO ───────────────────
    erro: "Erro", sucesso: "Sucesso", aviso: "Aviso", info: "Informação", carregando: "Carregando...", aguarde: "Aguarde...",
    erroBuscar: "Erro ao buscar dados", erroEnviar: "Erro ao enviar", erroSalvar: "Erro ao salvar", naoAutenticado: "Não autenticado",
    sessionExpirada: "Sessão expirada. Faça login novamente", semConexao: "Sem conexão com o servidor", tPaga: "Tente novamente",
    emailInvalido: "E-mail inválido", senhaFraca: "Senha fraca (mín. 6 caracteres)", emailJaRegistrado: "E-mail já registrado",

    // ─────────────────── OUTRAS ───────────────────
    carregar: "Carregar", recarregar: "Recarregar", atualizar: "Atualizar", copiar: "Copiar", copiado: "Copiado!",
    compartilhar: "Compartilhar", exportar: "Exportar", importar: "Importar", configurar: "Configurar", ok: "OK",
    semDados: "Sem dados", vazio: "Vazio", carregando2: "Carregando dados...", esperando: "Esperando...",
    ativo: "Ativo", inativo: "Inativo", habilitado: "Habilitado", desabilitado: "Desabilitado",
    premium: "Premium", gratuito: "Gratuito", ativacao: "Ativação", expirado: "Expirado", validade: "Validade",
  },

  en: {
    // ─────────────────── NAVIGATION ───────────────────
    inicio: "Home", sinais: "Signals", desempenho: "Performance", historico: "History", mais: "More", voltar: "Back",

    // ─────────────────── HOME ───────────────────
    ola: "Hi", dashboard: "Dashboard", bemVindo: "Welcome", operacoesHoje: "Operations today",
    ganhos: "Wins", perdas: "Losses", assertividade: "Win rate", pips: "pips", ops: "ops",
    ultimosSinais: "Latest signals", todos: "All", diaAtivo: "Active day", semanaAtiva: "Active week", mesAtivo: "Active month",
    diaFimDeSemana: "Weekend — Forex market closed", naoHaOperacoes: "No operations right now",
    operacaoRodando: "Operation running — waiting for TP or SL", proximoSinalAbrem: "Next signal opens when this closes",

    // ─────────────────── SIGNALS ───────────────────
    sinaisAtivos: "Active signals", emAndamento: "In progress", resultado: "Result", avisarAoFechar: "Alert when closed",
    compra: "Buy", venda: "Sell", compras: "Buys", vendas: "Sells", entrada: "Entry", alvo: "Target", stop: "Stop",
    entradadef: "Entry", alvoDef: "Target", stopDef: "Stop", statusAberto: "open", statusGanho: "win", statusPerda: "loss",

    // ─────────────────── PERFORMANCE ───────────────────
    curvaDeCapital: "Equity curve", semana: "Week", mes: "Month", geral: "Overall", periodo: "Period",
    semanaLabel: "This week", mesLabel: "Month", geralLabel: "Overall", desempenhoAtivos: "Performance by asset",
    desempenhoTimeframes: "Performance by timeframe", win: "Win", loss: "Loss", rr: "R:R",

    // ─────────────────── HISTORY ───────────────────
    operacoesFechadas: "Closed operations", filtrar: "Filter", limpar: "Clear", semResultados: "No results",
    verMais: "See more", naoHaOperacoes2: "No operations yet",

    // ─────────────────── PROFILE ───────────────────
    perfil: "My profile", meusDados: "My data", preferencias: "Preferences", sair: "Logout", nome: "Name", email: "Email",
    telefone: "Phone", senha: "Password", novaSenh: "New password", altarEmail: "Change email", alterarSenha: "Change password",
    editarPerfil: "Edit profile", salvar: "Save", cancelar: "Cancel", fechar: "Close",

    // ─────────────────── SETTINGS ───────────────────
    tema: "Theme", claro: "Light", escuro: "Dark", idioma: "Language", portuguese: "Portuguese", english: "English", spanish: "Spanish",
    horarioSinais: "Signal schedule", diaInteiro: "All day", horarioFixo: "Fixed schedule", inicio: "Start", fim: "End",
    janela: "Window", horario: "Time", ativos: "Assets", timeframes: "Timeframes", ativosSelecionados: "Selected assets",
    escolhaAtivos: "Choose your assets", editarAtivos: "Edit assets and timeframes", escolhaTimeframes: "Choose timeframes",
    language_desc: "Choose your preferred language. Auto-saved.", schedule_saved: "Schedule saved!",

    // ─────────────────── PLANS ───────────────────
    plan: "Plan", free: "Free", mensal: "Monthly", anual: "Yearly", aluno: "Student", premium: "Premium",
    escolhaPlano: "Choose your plan", assinar: "Subscribe", cancearPlano: "Cancel plan", upgrade: "Upgrade",
    operacoesDia: "operations/day", acesso24: "24h access", horarioCustomizado: "Custom schedule",

    // ─────────────────── AUTH ───────────────────
    entrar: "Sign in", cadastrar: "Sign up", loginComEmail: "Sign in with email", novaConta: "Create account",
    esqueceuSenha: "Forgot password?", enviar: "Send", redefinir: "Reset", confirmar: "Confirm",
    confirmeSenha: "Confirm password", cupom: "Coupon", referencia: "Referral code", jaTemConta: "Already have an account?",

    // ─────────────────── ADMIN ───────────────────
    paineladmin: "Admin panel", usuarios: "Users", saudeDoSistema: "System health", verificarAgora: "Check now",
    reconstruirLaudo: "Rebuild report", monitoramentoDeErros: "Error monitoring", ultimasfalhas: "Latest failures",
    seEstiverVazio: "If empty, everything is running smoothly.", limparErros: "Clear errors", clicNaLinha: "Click for details",
    operacoesAbertas: "Open operations", diagnostico: "Diagnostics", divergencias: "Divergences", presas: "Stuck (>12h)",
    autoResolvidas: "Auto-resolved", buckets: "Buckets", fechados: "Closed", laudoPips: "Report pips",

    // ─────────────────── NOTIFICATIONS ───────────────────
    notificacoes: "Notifications", centralNotificacoes: "Notification center", novasNotificacoes: "New notifications",
    sinalAberto: "Signal opened", sinalFechado: "Signal closed", ganhou: "Won!", perdeu: "Lost", tp: "TP", sl: "SL",
    ativarNotificacoes: "Enable notifications", permitirNotificacoes: "Allow push notifications",

    // ─────────────────── FAQ ───────────────────
    centralAjuda: "Help center", perguntas: "Frequently asked questions", oQueEh: "What is?", comoFunciona: "How it works?",
    leia: "Read", expandir: "Expand", colapsar: "Collapse",

    // ─────────────────── ERROR/SUCCESS MSGS ───────────────────
    erro: "Error", sucesso: "Success", aviso: "Warning", info: "Info", carregando: "Loading...", aguarde: "Please wait...",
    erroBuscar: "Error fetching data", erroEnviar: "Error sending", erroSalvar: "Error saving", naoAutenticado: "Not authenticated",
    sessionExpirada: "Session expired. Sign in again", semConexao: "No connection to server", tPaga: "Try again",
    emailInvalido: "Invalid email", senhaFraca: "Weak password (min. 6 chars)", emailJaRegistrado: "Email already registered",

    // ─────────────────── OTHER ───────────────────
    carregar: "Load", recarregar: "Reload", atualizar: "Update", copiar: "Copy", copiado: "Copied!",
    compartilhar: "Share", exportar: "Export", importar: "Import", configurar: "Configure", ok: "OK",
    semDados: "No data", vazio: "Empty", carregando2: "Loading data...", esperando: "Waiting...",
    ativo: "Active", inativo: "Inactive", habilitado: "Enabled", desabilitado: "Disabled",
    premium: "Premium", gratuito: "Free", ativacao: "Activation", expirado: "Expired", validade: "Expiry",
  },

  es: {
    // ─────────────────── NAVEGACIÓN ───────────────────
    inicio: "Inicio", sinais: "Señales", desempenho: "Rendimiento", historico: "Historial", mais: "Más", voltar: "Atrás",

    // ─────────────────── HOME ───────────────────
    ola: "Hola", dashboard: "Panel", bemVindo: "Bienvenido", operacoesHoje: "Operaciones hoy",
    ganhos: "Ganancias", perdas: "Pérdidas", assertividade: "Acierto", pips: "pips", ops: "ops",
    ultimosSinais: "Últimas señales", todos: "Todos", diaAtivo: "Día activo", semanaAtiva: "Semana activa", mesAtivo: "Mes activo",
    diaFimDeSemana: "Fin de semana — mercado Forex cerrado", naoHaOperacoes: "Sin operaciones ahora",
    operacaoRodando: "Operación en curso — esperando TP o SL", proximoSinalAbrem: "Próxima señal se abre cuando esta cierre",

    // ─────────────────── SEÑALES ───────────────────
    sinaisAtivos: "Señales activas", emAndamento: "En progreso", resultado: "Resultado", avisarAoFechar: "Alertar al cerrar",
    compra: "Compra", venda: "Venta", compras: "Compras", vendas: "Ventas", entrada: "Entrada", alvo: "Objetivo", stop: "Stop",
    entradadef: "Entrada", alvoDef: "Objetivo", stopDef: "Stop", statusAberto: "abierto", statusGanho: "ganancia", statusPerda: "pérdida",

    // ─────────────────── RENDIMIENTO ───────────────────
    curvaDeCapital: "Curva de capital", semana: "Semana", mes: "Mes", geral: "General", periodo: "Período",
    semanaLabel: "Esta semana", mesLabel: "Mes", geralLabel: "General", desempenhoAtivos: "Rendimiento por activo",
    desempenhoTimeframes: "Rendimiento por marco de tiempo", win: "Ganancia", loss: "Pérdida", rr: "R:R",

    // ─────────────────── HISTORIAL ───────────────────
    operacoesFechadas: "Operaciones cerradas", filtrar: "Filtrar", limpar: "Limpiar", semResultados: "Sin resultados",
    verMais: "Ver más", naoHaOperacoes2: "Ninguna operación aún",

    // ─────────────────── PERFIL ───────────────────
    perfil: "Mi perfil", meusDados: "Mis datos", preferencias: "Preferencias", sair: "Cerrar sesión", nome: "Nombre", email: "Correo",
    telefone: "Teléfono", senha: "Contraseña", novaSenh: "Nueva contraseña", altarEmail: "Cambiar correo", alterarSenha: "Cambiar contraseña",
    editarPerfil: "Editar perfil", salvar: "Guardar", cancelar: "Cancelar", fechar: "Cerrar",

    // ─────────────────── AJUSTES ───────────────────
    tema: "Tema", claro: "Claro", escuro: "Oscuro", idioma: "Idioma", portuguese: "Portugués", english: "Inglés", spanish: "Español",
    horarioSinais: "Horario de señales", diaInteiro: "Todo el día", horarioFixo: "Horario fijo", inicio: "Inicio", fim: "Fin",
    janela: "Ventana", horario: "Hora", ativos: "Activos", timeframes: "Marcos de tiempo", ativosSelecionados: "Activos seleccionados",
    escolhaAtivos: "Elige tus activos", editarAtivos: "Editar activos y marcos de tiempo", escolhaTimeframes: "Elige marcos de tiempo",
    language_desc: "Elige tu idioma preferido. Auto-guardado.", schedule_saved: "¡Horario guardado!",

    // ─────────────────── PLANES ───────────────────
    plan: "Plan", free: "Gratis", mensal: "Mensual", anual: "Anual", aluno: "Estudiante", premium: "Premium",
    escolhaPlano: "Elige tu plan", assinar: "Suscribirse", cancearPlano: "Cancelar plan", upgrade: "Actualizar",
    operacoesDia: "operaciones/día", acesso24: "Acceso 24h", horarioCustomizado: "Horario personalizado",

    // ─────────────────── AUTH ───────────────────
    entrar: "Iniciar sesión", cadastrar: "Registrarse", loginComEmail: "Iniciar sesión con correo", novaConta: "Crear cuenta",
    esqueceuSenha: "¿Olvidó la contraseña?", enviar: "Enviar", redefinir: "Restablecer", confirmar: "Confirmar",
    confirmeSenha: "Confirmar contraseña", cupom: "Cupón", referencia: "Código de referencia", jaTemConta: "¿Ya tiene cuenta?",

    // ─────────────────── ADMIN ───────────────────
    paineladmin: "Panel de administración", usuarios: "Usuarios", saudeDoSistema: "Salud del sistema", verificarAgora: "Verificar ahora",
    reconstruirLaudo: "Reconstruir informe", monitoramentoDeErros: "Monitoreo de errores", ultimasfalhas: "Últimos fallos",
    seEstiverVazio: "Si está vacío, todo funciona correctamente.", limparErros: "Limpiar errores", clicNaLinha: "Haz clic para detalles",
    operacoesAbertas: "Operaciones abiertas", diagnostico: "Diagnóstico", divergencias: "Divergencias", presas: "Atrapadas (>12h)",
    autoResolvidas: "Auto-resueltas", buckets: "Cubos", fechados: "Cerrados", laudoPips: "Informe pips",

    // ─────────────────── NOTIFICACIONES ───────────────────
    notificacoes: "Notificaciones", centralNotificacoes: "Centro de notificaciones", novasNotificacoes: "Nuevas notificaciones",
    sinalAberto: "Señal abierta", sinalFechado: "Señal cerrada", ganhou: "¡Ganó!", perdeu: "Perdió", tp: "TP", sl: "SL",
    ativarNotificacoes: "Habilitar notificaciones", permitirNotificacoes: "Permitir notificaciones push",

    // ─────────────────── FAQ ───────────────────
    centralAjuda: "Centro de ayuda", perguntas: "Preguntas frecuentes", oQueEh: "¿Qué es?", comoFunciona: "¿Cómo funciona?",
    leia: "Lea", expandir: "Expandir", colapsar: "Colapsar",

    // ─────────────────── MSGS DE ERROR/ÉXITO ───────────────────
    erro: "Error", sucesso: "Éxito", aviso: "Advertencia", info: "Información", carregando: "Cargando...", aguarde: "Por favor espere...",
    erroBuscar: "Error al obtener datos", erroEnviar: "Error al enviar", erroSalvar: "Error al guardar", naoAutenticado: "No autenticado",
    sessionExpirada: "Sesión expirada. Inicie sesión nuevamente", semConexao: "Sin conexión al servidor", tPaga: "Intente de nuevo",
    emailInvalido: "Correo inválido", senhaFraca: "Contraseña débil (mín. 6 caracteres)", emailJaRegistrado: "Correo ya registrado",

    // ─────────────────── OTROS ───────────────────
    carregar: "Cargar", recarregar: "Recargar", atualizar: "Actualizar", copiar: "Copiar", copiado: "¡Copiado!",
    compartilhar: "Compartir", exportar: "Exportar", importar: "Importar", configurar: "Configurar", ok: "OK",
    semDados: "Sin datos", vazio: "Vacío", carregando2: "Cargando datos...", esperando: "Esperando...",
    ativo: "Activo", inativo: "Inactivo", habilitado: "Habilitado", desabilitado: "Deshabilitado",
    premium: "Premium", gratuito: "Gratis", ativacao: "Activación", expirado: "Expirado", validade: "Vencimiento",
  },
};

export function getSavedLanguage() {
  try {
    return localStorage.getItem("tfx_language") || "pt";
  } catch {
    return "pt";
  }
}

export function saveLanguagePreference(lang) {
  try {
    localStorage.setItem("tfx_language", lang);
  } catch { /* ignore */ }
}

// Helper: pega string traduzida com fallback
export function txt(key, translations, language) {
  return translations[language]?.[key] || translations.pt?.[key] || key;
}
