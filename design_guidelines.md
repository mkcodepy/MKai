{
  "brand": {
    "name_suggestion": "AtendeAI Console",
    "attributes": [
      "confiável e operacional (instrument panel)",
      "moderno e calmo (teal/ocean)",
      "alta densidade com respiro (whitespace 2–3x)",
      "orientado a estados em tempo real (streaming, handoff, pausas)",
      "Português-BR, linguagem objetiva"
    ],
    "anti_patterns": [
      "não usar roxo (AI/chat)",
      "não usar gradientes escuros/saturados",
      "não centralizar layout global",
      "evitar sombras pesadas; preferir bordas 1px + sombras suaves"
    ]
  },

  "design_tokens": {
    "fonts": {
      "heading": {
        "family": "Space Grotesk",
        "fallback": "ui-sans-serif, system-ui",
        "weights": [500, 600, 700],
        "usage": "Títulos, números de métricas, nomes de assistentes"
      },
      "body": {
        "family": "Figtree",
        "fallback": "ui-sans-serif, system-ui",
        "weights": [400, 500, 600],
        "usage": "UI, tabelas, textos longos, mensagens"
      },
      "mono": {
        "family": "IBM Plex Mono",
        "fallback": "ui-monospace, SFMono-Regular",
        "usage": "IDs, tokens, modelo selecionado, logs de streaming"
      },
      "implementation_notes": {
        "google_fonts": [
          "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Figtree:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        ],
        "tailwind": "Definir fontFamily em tailwind.config.js: heading: ['Space Grotesk', ...], sans: ['Figtree', ...], mono: ['IBM Plex Mono', ...]"
      }
    },

    "typography_scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "section_title": "text-lg md:text-xl font-semibold tracking-tight",
      "kpi_number": "text-2xl md:text-3xl font-semibold tabular-nums",
      "body": "text-sm md:text-base leading-6",
      "small": "text-xs md:text-sm text-muted-foreground",
      "mono": "font-mono text-xs"
    },

    "color_system": {
      "notes": [
        "Base clara (produtividade) com superfícies levemente ‘mint/sand’ para reduzir fadiga.",
        "Teal/ocean como primário; âmbar suave para alertas; vermelho só para destrutivo.",
        "Estados em tempo real precisam de cores semânticas consistentes (badges)."
      ],
      "css_variables": {
        ":root": {
          "--background": "180 33% 99%",
          "--foreground": "200 20% 10%",

          "--card": "0 0% 100%",
          "--card-foreground": "200 20% 10%",

          "--popover": "0 0% 100%",
          "--popover-foreground": "200 20% 10%",

          "--primary": "173 80% 28%",
          "--primary-foreground": "0 0% 100%",

          "--secondary": "174 45% 96%",
          "--secondary-foreground": "200 20% 14%",

          "--muted": "174 28% 94%",
          "--muted-foreground": "196 10% 40%",

          "--accent": "186 55% 92%",
          "--accent-foreground": "200 20% 14%",

          "--border": "174 18% 86%",
          "--input": "174 18% 86%",
          "--ring": "173 80% 28%",

          "--destructive": "0 72% 52%",
          "--destructive-foreground": "0 0% 100%",

          "--success": "158 64% 34%",
          "--warning": "38 92% 50%",
          "--info": "199 89% 48%",

          "--radius": "0.75rem"
        },
        ".dark": {
          "--background": "200 22% 8%",
          "--foreground": "180 20% 96%",
          "--card": "200 22% 10%",
          "--card-foreground": "180 20% 96%",
          "--popover": "200 22% 10%",
          "--popover-foreground": "180 20% 96%",
          "--primary": "173 70% 45%",
          "--primary-foreground": "200 22% 10%",
          "--secondary": "200 18% 14%",
          "--secondary-foreground": "180 20% 96%",
          "--muted": "200 18% 14%",
          "--muted-foreground": "180 10% 70%",
          "--accent": "200 18% 16%",
          "--accent-foreground": "180 20% 96%",
          "--border": "200 16% 18%",
          "--input": "200 16% 18%",
          "--ring": "173 70% 45%",
          "--destructive": "0 62% 40%",
          "--destructive-foreground": "0 0% 100%",
          "--success": "158 55% 42%",
          "--warning": "38 85% 55%",
          "--info": "199 80% 55%"
        }
      },
      "allowed_gradients": {
        "usage": "Somente em fundos de seção (hero do Dashboard / WhatsApp) e overlays decorativos; nunca em áreas de leitura.",
        "max_viewport_coverage": "<= 20%",
        "examples": [
          "bg-[radial-gradient(1200px_circle_at_20%_0%,hsl(186_55%_92%)_0%,transparent_55%)]",
          "bg-[linear-gradient(135deg,hsl(174_45%_96%)_0%,hsl(180_33%_99%)_55%,transparent_100%)]"
        ]
      }
    },

    "spacing_and_layout": {
      "container": "max-w-[1400px] px-4 sm:px-6 lg:px-8",
      "density": {
        "default": "Espaçamento confortável (p-4/p-6) em páginas de configuração.",
        "operational": "Densidade maior (p-3, text-sm) na Inbox e tabelas, mantendo line-height e contraste."
      },
      "radii": {
        "card": "rounded-xl",
        "input": "rounded-lg",
        "pill_badge": "rounded-full"
      },
      "shadows": {
        "rule": "Preferir borda 1px + sombra suave; evitar sombras grandes.",
        "tokens": [
          "shadow-sm",
          "shadow-[0_1px_0_rgba(0,0,0,0.04)]",
          "shadow-[0_10px_30px_rgba(2,44,43,0.08)] (somente em modais/sheets)"
        ]
      }
    }
  },

  "layout_blueprints": {
    "app_shell": {
      "pattern": "Sidebar persistente + Topbar contextual",
      "sidebar": {
        "width": "w-[260px]",
        "mobile": "Sheet (hamburger) com navegação",
        "sections": [
          "Dashboard",
          "Assistentes",
          "Base de Conhecimento",
          "Playground",
          "Conversas",
          "Canal WhatsApp"
        ],
        "details": [
          "Mostrar status global do WhatsApp (dot + label) no rodapé da sidebar.",
          "Mostrar seletor de Assistente ativo (Command) quando estiver em Playground/Conversas."
        ]
      },
      "topbar": {
        "left": "Breadcrumb + título da página",
        "right": "Busca global (Command), botão Novo Assistente, avatar/menu",
        "sticky": "sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b"
      }
    },

    "inbox_three_column": {
      "goal": "Operação rápida: triagem -> leitura -> ação sem trocar de tela.",
      "grid": "Desktop: 3 colunas (lista 320px / thread flex / painel 360px). Tablet: 2 colunas (painel vira Sheet). Mobile: lista -> thread (navegação por rotas).",
      "left_column_conversation_list": {
        "components": ["ScrollArea", "Input", "Tabs", "Badge", "Avatar", "Separator"],
        "must_have": [
          "Busca por nome/telefone/tag",
          "Filtros salvos (Tabs): Não atribuídas, Minhas, Em andamento, Resolvidas",
          "Badges: canal (WhatsApp), SLA/tempo, handoff",
          "Preview da última mensagem + indicador de não lidas"
        ],
        "row_design": "Linha com hover bg-accent/60, estado ativo com border-l-2 border-primary + bg-secondary"
      },
      "center_thread": {
        "components": ["Card", "ScrollArea", "Textarea", "Button", "Tooltip", "DropdownMenu", "Skeleton"],
        "header": [
          "Nome do contato + telefone (mono)",
          "Status chips: IA ativa/pausada, humano assumiu, aguardando cliente",
          "Ações rápidas: Marcar resolvido, Transferir p/ humano, Pausar/Retomar IA"
        ],
        "message_bubbles": {
          "customer": "bg-secondary text-foreground rounded-2xl rounded-bl-md",
          "assistant": "bg-card border rounded-2xl rounded-br-md",
          "internal_note": "bg-[hsl(var(--warning)/0.12)] border border-[hsl(var(--warning)/0.25)] rounded-xl",
          "meta": "timestamp text-xs text-muted-foreground; status (enviado/entregue/lido) como ícones discretos"
        },
        "composer": {
          "states": [
            "Dentro da janela 24h: input normal",
            "Fora da janela 24h: bloquear envio livre e oferecer Select de templates",
            "Streaming: botão vira 'Parar geração' + indicador de digitando",
            "IA pausada: composer mostra Alert com CTA 'Retomar IA'"
          ],
          "interaction": "Enter envia, Shift+Enter quebra linha; botão enviar com press scale-95"
        }
      },
      "right_panel_details": {
        "components": ["Tabs", "Card", "Table", "Badge", "Switch", "Separator", "Accordion"],
        "tabs": ["Contato", "IA", "CRM"],
        "content": [
          "Contato: tags, idioma, histórico, consentimento",
          "IA: assistente vinculado, regras ativas, temperatura/modelo, toggle Bot/Humano",
          "CRM: campos customizados, estágio, responsável"
        ],
        "mobile": "Virar Sheet (Drawer/Sheet) acionado por botão 'Detalhes'"
      }
    },

    "assistant_editor": {
      "pattern": "Página com header fixo + Tabs horizontais + painel lateral de preview",
      "tabs": [
        "Modelo",
        "Personalidade & Tom",
        "Regras & Guardrails",
        "Objetivos",
        "Handoff",
        "Mensagens padrão"
      ],
      "layout": "Desktop: conteúdo (2/3) + preview (1/3) com chat mini; Mobile: preview vira Drawer.",
      "key_interactions": [
        "Salvar com estado: idle/saving/saved/error",
        "Validação inline (Alert) para guardrails conflitantes",
        "Botão 'Testar no Playground' abre rota com assistente pré-selecionado"
      ]
    },

    "knowledge_base": {
      "pattern": "Uploader + lista de fontes + editor de texto/Q&A",
      "must_have": [
        "Upload PDF/DOCX/TXT com progresso",
        "Estados: processando, indexado, erro",
        "Vincular a um assistente (Select/Command)",
        "Área 'Colar texto' e 'Perguntas & Respostas' (Accordion)"
      ]
    },

    "whatsapp_channel": {
      "pattern": "Status card + QR Code card + simulador interno",
      "status_states": ["Desconectado", "Conectando", "Conectado"],
      "qr": "Card com QR grande (min 260px), instruções em lista curta, botão 'Atualizar QR'",
      "simulator": "Chat split: Cliente (esquerda) / IA (direita) com toggles de eventos (mensagem recebida, fora da janela 24h, falha de envio)"
    }
  },

  "components": {
    "component_path": {
      "shadcn_primary": [
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/textarea.jsx",
        "/app/frontend/src/components/ui/select.jsx",
        "/app/frontend/src/components/ui/command.jsx",
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/skeleton.jsx",
        "/app/frontend/src/components/ui/switch.jsx",
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/sonner.jsx",
        "/app/frontend/src/components/ui/calendar.jsx",
        "/app/frontend/src/components/ui/resizable.jsx"
      ],
      "recommended_new_composites_js": [
        "src/components/AppShell.js (Sidebar + Topbar)",
        "src/components/InboxLayout.js (3-col + responsive sheets)",
        "src/components/ConversationListItem.js",
        "src/components/MessageBubble.js",
        "src/components/StreamingComposer.js",
        "src/components/AssistantMiniPreview.js",
        "src/components/WhatsAppStatusCard.js",
        "src/components/QRCodePanel.js"
      ]
    },

    "button_system": {
      "style": "Professional / Corporate com toque ‘calmo’",
      "tokens": {
        "--btn-radius": "10px",
        "--btn-shadow": "0 1px 0 rgba(0,0,0,0.04)",
        "--btn-press-scale": "0.98"
      },
      "variants": {
        "primary": "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary)/0.92)] focus-visible:ring-2 focus-visible:ring-ring",
        "secondary": "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--secondary)/0.75)] border",
        "ghost": "hover:bg-accent hover:text-accent-foreground",
        "destructive": "bg-destructive text-destructive-foreground hover:bg-[hsl(var(--destructive)/0.92)]"
      },
      "micro_interactions": [
        "hover: leve elevação (shadow-sm) apenas em botões primários",
        "active: scale-[0.98]",
        "loading: spinner inline + texto 'Salvando…'"
      ]
    },

    "badges_and_status": {
      "rules": [
        "Badges sempre com ícone pequeno + texto curto.",
        "Usar cores semânticas consistentes em toda a app."
      ],
      "status_map": {
        "whatsapp_connected": "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.25)]",
        "whatsapp_connecting": "bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))] border border-[hsl(var(--info)/0.25)]",
        "whatsapp_disconnected": "bg-muted text-muted-foreground border",
        "ai_paused": "bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.25)]",
        "handoff_required": "bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.25)]",
        "resolved": "bg-secondary text-secondary-foreground border"
      }
    }
  },

  "motion_and_microinteractions": {
    "library": {
      "recommended": "framer-motion",
      "install": "npm i framer-motion",
      "usage": [
        "Entrada suave de cards (opacity + y)",
        "Transição de seleção na lista de conversas",
        "Indicador de streaming (dots)"
      ],
      "reduced_motion": "Respeitar prefers-reduced-motion: desabilitar animações de entrada e parallax"
    },
    "patterns": {
      "hover": "Somente em elementos interativos: hover:bg-accent/60, hover:shadow-sm",
      "focus": "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "streaming": "Cursor/pulse no final da mensagem do bot + skeleton de linhas curtas",
      "resizable": "Usar Resizable para ajustar largura das colunas (desktop power users)"
    }
  },

  "data_testid_conventions": {
    "rule": "Todo elemento interativo e informação crítica deve ter data-testid em kebab-case.",
    "examples": [
      "data-testid=\"sidebar-nav-conversas\"",
      "data-testid=\"dashboard-kpi-conversas-ativas\"",
      "data-testid=\"assistant-editor-save-button\"",
      "data-testid=\"knowledge-upload-input\"",
      "data-testid=\"playground-send-button\"",
      "data-testid=\"inbox-conversation-list-item\"",
      "data-testid=\"inbox-toggle-ai-pause\"",
      "data-testid=\"whatsapp-qr-refresh-button\""
    ]
  },

  "accessibility": {
    "wcag": "AA",
    "requirements": [
      "Contraste: texto normal >= 4.5:1; badges e placeholders não podem ficar ‘lavados’.",
      "Foco visível em todos os controles (ring).",
      "Teclado: navegação na lista (setas) + Enter para abrir conversa (opcional).",
      "ARIA: labels em inputs; tooltips não devem ser a única forma de informação.",
      "Preferências: respeitar reduced motion."
    ]
  },

  "image_urls": {
    "whatsapp_channel": [
      {
        "category": "whatsapp-setup-hero",
        "description": "Imagem discreta para o topo da página Canal WhatsApp (contexto de dispositivo/QR). Usar com overlay leve e blur; não competir com o QR real.",
        "url": "https://images.unsplash.com/photo-1537267470831-2d781a5d2ae6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwyfHx3aGF0c2FwcCUyMHFyJTIwY29kZSUyMHBob25lJTIwc2Nhbm5pbmd8ZW58MHx8fGJsdWV8MTc4ODgyNzc0NHww&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "whatsapp-setup-secondary",
        "description": "Imagem alternativa para cards vazios/estado inicial (ex.: antes de gerar QR).",
        "url": "https://images.unsplash.com/photo-1528254609158-ae7dfaa48ab3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwzfHx3aGF0c2FwcCUyMHFyJTIwY29kZSUyMHBob25lJTIwc2Nhbm5pbmd8ZW58MHx8fGJsdWV8MTc4ODgyNzc0NHww&ixlib=rb-4.1.0&q=85"
      }
    ]
  },

  "instructions_to_main_agent": {
    "global_css_updates": [
      "Atualizar /app/frontend/src/index.css tokens (:root e .dark) para o sistema teal/ocean acima.",
      "Remover/ignorar estilos default do CRA em App.css (App-header centralizado etc). Manter App.css mínimo ou vazio.",
      "Adicionar import de Google Fonts no index.html (ou via CSS @import) e setar font-family no body para Figtree; headings via utility class font-heading."
    ],
    "page_level_guidance": [
      "Inbox: implementar layout 3 colunas com Resizable no desktop e Sheet no mobile para painel de detalhes.",
      "Editor de Assistentes: Tabs + preview mini-chat; salvar com estados e toasts (sonner).",
      "Playground: chat streaming com botão 'Parar' e indicador de digitando; reset de sessão.",
      "WhatsApp: status + QR + simulador; estados claros (desconectado/conectando/conectado)."
    ],
    "component_usage_rules": [
      "Usar shadcn/ui para dropdown/select/dialog/sheet/calendar/toast (sonner).",
      "Todos os botões/inputs/itens clicáveis e KPIs devem ter data-testid.",
      "Não usar transition: all; aplicar transições apenas em cores/sombra/opacidade."
    ],
    "suggested_icon_library": {
      "lucide": "Preferir lucide-react (ícones: MessageSquare, Bot, User, Pause, Play, QrCode, PlugZap, Shield, BookOpen, Gauge).",
      "note": "Não usar emojis como ícones."
    }
  },

  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
