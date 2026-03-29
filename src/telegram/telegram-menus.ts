// src/telegram/telegram-menus.ts
// Teclados inline do bot — botões clicáveis no Telegram

import type { SearchResult } from "../types/index.ts";
import type { InlineButton, MenuReturn } from "../types/telegram.ts";

export function menuPrincipal(userName = ""): MenuReturn {
  const saudacao = userName ? `Olá, ${userName}! ` : "";
  return {
    text: `${saudacao}O que você quer fazer?`,
    buttons: [
      [{ text: "📰 Minhas notícias", callback_data: "cmd:noticias" }],
      [{ text: "🎬 Roteiro YouTube", callback_data: "cmd:roteiro" }],
      [
        { text: "👤 Meu perfil", callback_data: "cmd:perfil" },
        { text: "⚙️ Configurações", callback_data: "menu:config" },
      ],
    ],
  };
}

export function menuPesquisa(interests: string[] = []): MenuReturn {
  const buttons: InlineButton[][] = interests
    .slice(0, 6)
    .map((interest) => [
      { text: `🔬 ${interest}`, callback_data: `research:${interest}` },
    ]);
  buttons.push([{ text: "« Voltar ao menu", callback_data: "menu:principal" }]);
  return {
    text:
      interests.length > 0
        ? "🔬 Pesquisa profunda\n\nEscolha um dos seus interesses:"
        : "🔬 Pesquisa profunda\n\nVocê ainda não tem interesses configurados. Adicione pelo menu de Configurações!",
    buttons,
  };
}

export function menuConfig(): MenuReturn {
  return {
    text: "⚙️ Configurações\n\nO que deseja alterar?",
    buttons: [
      [
        { text: "➕ Adicionar interesse", callback_data: "cmd:adicionar" },
        { text: "➖ Remover interesse", callback_data: "cmd:remover" },
      ],
      [
        { text: "⏰ Horário do resumo", callback_data: "menu:horario" },
        { text: "🎨 Estilo do resumo", callback_data: "menu:estilo" },
      ],
      [{ text: "« Voltar ao menu", callback_data: "menu:principal" }],
    ],
  };
}

export function menuHorario(): MenuReturn {
  return {
    text: "⏰ Qual horário você quer receber seu resumo diário?",
    buttons: [
      [
        { text: "🌅 07:00", callback_data: "horario:0 7 * * *" },
        { text: "☀️ 08:00", callback_data: "horario:0 8 * * *" },
      ],
      [
        { text: "🍽️ 12:00", callback_data: "horario:0 12 * * *" },
        { text: "🌆 18:00", callback_data: "horario:0 18 * * *" },
      ],
      [
        { text: "🌙 21:00", callback_data: "horario:0 21 * * *" },
        { text: "🌃 22:00", callback_data: "horario:0 22 * * *" },
      ],
      [{ text: "« Voltar", callback_data: "menu:config" }],
    ],
  };
}

export function menuEstilo(): MenuReturn {
  return {
    text: "🎨 Como você prefere receber o resumo?",
    buttons: [
      [
        {
          text: "• Bullet points (padrão)",
          callback_data: "estilo:bullet-points",
        },
      ],
      [{ text: "📄 Parágrafos curtos", callback_data: "estilo:curto" }],
      [{ text: "📖 Parágrafos detalhados", callback_data: "estilo:detalhado" }],
      [{ text: "« Voltar", callback_data: "menu:config" }],
    ],
  };
}

export function menuNoticias(
  results: SearchResult[],
  query: string,
): MenuReturn {
  const buttons: InlineButton[][] = results.map((r, i) => [
    {
      text: `${i + 1}. ${r.title.substring(0, 40)}${r.title.length > 40 ? "…" : ""}`,
      callback_data: `noticia:${i}`,
    },
  ]);
  buttons.push([
    { text: "🔬 Pesquisa profunda", callback_data: `research:${query}` },
    { text: "« Menu principal", callback_data: "menu:principal" },
  ]);
  return {
    text: `📰 Notícias sobre "${query}"\n\nClique para ler o resumo:`,
    buttons,
  };
}
