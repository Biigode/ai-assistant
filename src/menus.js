// src/menus.js
// Todos os teclados inline do bot — botões clicáveis no Telegram
// Cada botão tem um callback_data que é processado no telegram-polling.js

// ─── Menu Principal ───────────────────────────────────────────────────────────

export function menuPrincipal(userName = '') {
  const saudacao = userName ? `Olá, ${userName}! ` : '';
  return {
    text: `${saudacao}O que você quer fazer?`,
    buttons: [
      [
        { text: '📰 Ver notícias',        callback_data: 'cmd:noticias' },
        { text: '📦 Receber digest',      callback_data: 'cmd:digest'   },
      ],
      [
        { text: '🔬 Pesquisa profunda',   callback_data: 'menu:pesquisa' },
        { text: '👤 Meu perfil',          callback_data: 'cmd:perfil'    },
      ],
      [
        { text: '⚙️ Configurações',       callback_data: 'menu:config'   },
        { text: '❓ Ajuda',               callback_data: 'cmd:ajuda'     },
      ],
    ],
  };
}

// ─── Menu de Pesquisa Profunda ────────────────────────────────────────────────

export function menuPesquisa(interests = []) {
  const buttons = [];

  // Botão para cada interesse cadastrado
  if (interests.length > 0) {
    for (const interest of interests.slice(0, 6)) {
      buttons.push([{
        text: `🔬 ${interest}`,
        callback_data: `research:${interest}`,
      }]);
    }
  }

  buttons.push([
    { text: '✏️ Digitar tema manualmente', callback_data: 'research:custom' },
  ]);
  buttons.push([
    { text: '« Voltar ao menu',            callback_data: 'menu:principal' },
  ]);

  return {
    text: interests.length > 0
      ? '🔬 Pesquisa profunda\n\nEscolha um dos seus interesses ou digite um tema:'
      : '🔬 Pesquisa profunda\n\nDigite o tema que deseja investigar:',
    buttons,
  };
}

// ─── Menu de Configurações ────────────────────────────────────────────────────

export function menuConfig() {
  return {
    text: '⚙️ Configurações\n\nO que deseja alterar?',
    buttons: [
      [
        { text: '➕ Adicionar interesse', callback_data: 'cmd:adicionar' },
        { text: '➖ Remover interesse',   callback_data: 'cmd:remover'   },
      ],
      [
        { text: '⏰ Horário do digest',   callback_data: 'menu:horario'  },
        { text: '🎨 Estilo do resumo',    callback_data: 'menu:estilo'   },
      ],
      [
        { text: '« Voltar ao menu',       callback_data: 'menu:principal' },
      ],
    ],
  };
}

// ─── Menu de Horário ──────────────────────────────────────────────────────────

export function menuHorario() {
  return {
    text: '⏰ Qual horário você quer receber o digest diário?',
    buttons: [
      [
        { text: '🌅 07:00',  callback_data: 'horario:0 7 * * *'  },
        { text: '☀️ 08:00',  callback_data: 'horario:0 8 * * *'  },
      ],
      [
        { text: '🍽️ 12:00', callback_data: 'horario:0 12 * * *' },
        { text: '🌆 18:00',  callback_data: 'horario:0 18 * * *' },
      ],
      [
        { text: '🌙 21:00',  callback_data: 'horario:0 21 * * *' },
        { text: '✏️ Outro horário', callback_data: 'horario:custom' },
      ],
      [
        { text: '« Voltar',  callback_data: 'menu:config' },
      ],
    ],
  };
}

// ─── Menu de Estilo ───────────────────────────────────────────────────────────

export function menuEstilo() {
  return {
    text: '🎨 Como você prefere receber o digest?',
    buttons: [
      [{ text: '• Bullet points (padrão)', callback_data: 'estilo:bullet-points' }],
      [{ text: '📄 Parágrafos curtos',      callback_data: 'estilo:curto'         }],
      [{ text: '📖 Parágrafos detalhados',  callback_data: 'estilo:detalhado'     }],
      [{ text: '« Voltar',                  callback_data: 'menu:config'           }],
    ],
  };
}

// ─── Menu de confirmação genérico ─────────────────────────────────────────────

export function menuConfirmar(texto, callbackSim, callbackNao = 'menu:principal') {
  return {
    text: texto,
    buttons: [
      [
        { text: '✅ Sim', callback_data: callbackSim  },
        { text: '❌ Não', callback_data: callbackNao  },
      ],
    ],
  };
}

// ─── Lista de notícias com botões numerados ───────────────────────────────────

export function menuNoticias(results, query) {
  const text = `📰 Notícias sobre "${query}"\n\nClique para ler o resumo:`;
  const buttons = results.map((r, i) => ([{
    text: `${i + 1}. ${r.title.substring(0, 40)}${r.title.length > 40 ? '…' : ''}`,
    callback_data: `noticia:${i}`,
  }]));

  buttons.push([
    { text: '🔬 Pesquisa profunda',  callback_data: `research:${query}` },
    { text: '« Menu principal',      callback_data: 'menu:principal'    },
  ]);

  return { text, buttons };
}
