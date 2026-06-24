// Internacionalização (i18n) — PT, EN, ES
export const translations = {
  pt: {
    // Navegação
    inicio: "Início", sinais: "Sinais", desempenho: "Desempenho", historico: "Histórico", mais: "Mais", voltar: "Voltar",
    // Home
    bemVindo: "Bem-vindo", operacoesHoje: "Operações hoje", ganhos: "Ganhos", perdas: "Perdas", assertividade: "Acerto", pips: "pips", ops: "ops",
    // Sinais
    sinaisAtivos: "Sinais ativos", emAndamento: "Em andamento", resultado: "Resultado", avisarAoFechar: "Avisar ao fechar",
    compra: "Compra", venda: "Venda", todos: "Todos", compras: "Compras", vendas: "Vendas",
    // Performance
    curvaDeCapital: "Curva de capital", semana: "Semana", mes: "Mês", geral: "Geral",
    // Perfil
    perfil: "Meu perfil", idioma: "Idioma", language_desc: "Escolha seu idioma preferido. Auto-salvo.",
    meusDados: "Meus dados", preferencias: "Preferências", sair: "Sair", nome: "Nome", email: "E-mail",
    // Admin
    paineladmin: "Painel admin", usuarios: "Usuários", saudeDoSistema: "Saúde do sistema", verificarAgora: "Verificar agora",
    monitoramentoDeErros: "Monitoramento de erros", ultimasfalhas: "Últimas falhas", seEstiverVazio: "Se estiver vazio, está tudo rodando sem erros.",
    // Buttons
    salvar: "Salvar", cancelar: "Cancelar", entrar: "Entrar", cadastrar: "Cadastrar", fechar: "Fechar",
  },
  en: {
    // Navigation
    inicio: "Home", sinais: "Signals", desempenho: "Performance", historico: "History", mais: "More", voltar: "Back",
    // Home
    bemVindo: "Welcome", operacoesHoje: "Operations today", ganhos: "Wins", perdas: "Losses", assertividade: "Win rate", pips: "pips", ops: "ops",
    // Signals
    sinaisAtivos: "Active signals", emAndamento: "In progress", resultado: "Result", avisarAoFechar: "Alert when closed",
    compra: "Buy", venda: "Sell", todos: "All", compras: "Buys", vendas: "Sells",
    // Performance
    curvaDeCapital: "Equity curve", semana: "Week", mes: "Month", geral: "Overall",
    // Profile
    perfil: "My profile", idioma: "Language", language_desc: "Choose your preferred language. Auto-saved.",
    meusDados: "My data", preferencias: "Preferences", sair: "Logout", nome: "Name", email: "Email",
    // Admin
    paineladmin: "Admin panel", usuarios: "Users", saudeDoSistema: "System health", verificarAgora: "Check now",
    monitoramentoDeErros: "Error monitoring", ultimasfalhas: "Latest failures", seEstiverVazio: "If empty, everything is running smoothly.",
    // Buttons
    salvar: "Save", cancelar: "Cancel", entrar: "Sign in", cadastrar: "Sign up", fechar: "Close",
  },
  es: {
    // Navegación
    inicio: "Inicio", sinais: "Señales", desempenho: "Rendimiento", historico: "Historial", mais: "Más", voltar: "Atrás",
    // Home
    bemVindo: "Bienvenido", operacoesHoje: "Operaciones hoy", ganhos: "Ganancias", perdas: "Pérdidas", assertividade: "Acierto", pips: "pips", ops: "ops",
    // Señales
    sinaisAtivos: "Señales activas", emAndamento: "En progreso", resultado: "Resultado", avisarAoFechar: "Alertar al cerrar",
    compra: "Compra", venda: "Venta", todos: "Todos", compras: "Compras", vendas: "Ventas",
    // Rendimiento
    curvaDeCapital: "Curva de capital", semana: "Semana", mes: "Mes", geral: "General",
    // Perfil
    perfil: "Mi perfil", idioma: "Idioma", language_desc: "Elige tu idioma preferido. Auto-guardado.",
    meusDados: "Mis datos", preferencias: "Preferencias", sair: "Cerrar sesión", nome: "Nombre", email: "Correo",
    // Admin
    paineladmin: "Panel de administración", usuarios: "Usuarios", saudeDoSistema: "Salud del sistema", verificarAgora: "Verificar ahora",
    monitoramentoDeErros: "Monitoreo de errores", ultimasfalhas: "Últimos fallos", seEstiverVazio: "Si está vacío, todo funciona correctamente.",
    // Buttons
    salvar: "Guardar", cancelar: "Cancelar", entrar: "Iniciar sesión", cadastrar: "Registrarse", fechar: "Cerrar",
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

// Helper: pega string traduzida com fallback pra PT
export function t(key, translations, language) {
  return translations[language]?.[key] || translations.pt?.[key] || key;
}
