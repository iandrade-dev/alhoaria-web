# Perfil do projeto — Alhoaria

Preenchido em 16/11/2026 a partir da base atual do `alhoaria-web`, do histórico do repositório e das preferências do Igor registradas no `ai-memory` (`strawberryfood-web`, `autiena`, `iandrade-dev` e `_global`), sem rodada de perguntas por solicitação explícita do usuário.

## Idioma do produto

Português do Brasil (`pt-BR`), voz direta de lanchonete/cozinha em Palhoça e São José/SC.

## Destino da saída

- Esqueletos em cinza (wireframes estruturais): HTML avulso dentro de `.deslop/wireframes/`.
- Implementação: diretamente no código do projeto (`Next.js 16` App Router, `React 19`, `TypeScript`, `Tailwind CSS`, `Framer Motion`, CSS Modules e `@react-three/fiber` / `three` na bancada 3D e AR).

## Fontes

As que o projeto já usa via `@fontsource`:
- `Anton` (display da landing e títulos de marca/seção);
- `Caveat Brush` (títulos manuais da bancada, marcações de cozinha e Comanda);
- `Inter Variable` (corpo, leitura, preços e controles).
Não trocar a família tipográfica sem pedido explícito.

## Ícones

`lucide-react` para controles de interface e ícones próprios WebP/3D da bancada (`public/assets/bancada/icones/`). Nenhum ícone genérico de IA (`✦`, sparkles, varinha mágica).

## Ilustração e mídia

- Fotos reais, renders próprios dos produtos (`public/assets/bancada/`), vídeos da cozinha (`public/assets/hero/`, `public/assets/home/`) e modelos 3D (`public/assets/models/bancada/`).
- Preservar `src/data/restaurante.ts` e `src/data/catalogo.ts` como fonte única white-label de identidade, cores, preços e unidades.
- Nunca inventar preços, fotos ou ilustrações no lugar dos assets do projeto.

## Vetos de partida

- Não trocar o Hero cinematográfico por entrada estática com botões imediatos nem recolocar barra fixa mobile (decisão revertida no commit `d1fb7eb`).
- Não remover horários e telefone dos cartões de unidades (`d1fb7eb`).
- Não remover rótulos pequenos de identificação dos ingredientes/bandejas na bancada ("tem coisa que não dá pra saber o que é", registrado no `ai-memory`).
- Não mexer na mecânica 3D e mão da bancada já aprovada do `alhoaria-web` ("o gesto de pegar funciona bem lá").
- Botão demais, ações idênticas repetidas em grade inteira, controles sobrepondo comida ou logo, painéis genéricos ("tela feia") que quebram o universo do produto.
- Textos de hype ou clichês de IA em português ("eleve", "revolucione", "na palma da sua mão", "vale conferir"), além de microcopy que explica o óbvio ou a lógica interna.
- Textos inclinados fora de contexto (permitido apenas no carimbo físico "com capricho" da Comanda).
- Carrosséis/listas horizontais com itens cortados sem indicar claramente que há mais itens fora da vista.
