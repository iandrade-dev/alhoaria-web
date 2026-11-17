# Receitas do projeto — Alhoaria

Extraído dos tokens reais em `src/app/globals.css`, `src/data/restaurante.ts`, `tailwind.config.ts`, `src/components/pedido/pedido.module.css`, `src/components/bancada-proto/turbinar.module.css` e `src/components/ar/modo-mesa.module.css`.

## Paleta

### Tema escuro (Landing `/`, escolha `/pedir`, cabeçalho e rodapé)
- Fundo (`--carvao`): `#0A0A0A`
- Superfície (`--carvao-leve`): `#141414`
- Borda (`--carvao-borda`): `#262626`
- Texto principal (`--osso`): `#F5F5F0`
- Texto secundário (`--osso-muted`): `#A8A8A0` (contrastes de leitura AA sobre `#0A0A0A` e `#141414`)
- Madeira apoio (`--madeira`, `--madeira-escura`): `#5C3D2E`, `#241812`

### Tema claro (Cardápio `/cardapio`, seção Fechamento e Comanda)
- Fundo papel creme (`--creme`): `#FFF8E7`
- Superfície elevada / cartão: `#FFFDF8`
- Borda quente: `#E1D3BD` (divisórias), `#CBBB9F` (controles)
- Texto principal: `#241812`
- Texto secundário: `#584032` / `#715647` (AA sobre `#FFF8E7` e `#FFFDF8`)

### Cena 3D / HUD (`/bancada` e `/ar`)
- Fundo da cena: `#120C09`
- Painel flutuante escuro: `#1B120D` / `rgba(18, 12, 9, 0.82)`
- Borda quente sobre cena: `rgba(255, 248, 231, 0.14)` ou `rgba(255, 202, 131, 0.25)`
- Papel da Comanda: `#FBF5E6` com texto `#1F1510` e carimbo `#C2410C`

### Destaques e estado
- Ação principal (`--macarico`): `#FF6A1A` (texto escuro sobre laranja: `#120C09` / `#241812`)
- Ouro / foco de acessibilidade (`--ouro`): `#E8B84A`
- Queijo (`--queijo`): `#F0C75E` / `#FFCF8A`

## Fontes

- Display (títulos da marca e seções da landing): `Anton` 400, caixa alta.
- Manual (cozinha, marcações de etapa da bancada, Comanda): `Caveat Brush` 400.
- Texto e UI (leitura, descrições, botões, preços): `Inter Variable`, pesos `400`/`600`/`700`/`800`, com `tabular-nums` em preços e totais.

## Superfícies

- **Landing e `/cardapio`:** superfícies sólidas (`#141414` sobre `#0A0A0A` no escuro; `#FFFDF8` sobre `#FFF8E7` no claro) definidas por borda fina (`1px`), sem sombras longas nem `backdrop-filter`.
- **Bancada 3D e AR:** `backdrop-filter: blur(14px) saturate(150%)` permitido **apenas** nas camadas flutuantes sobre a cena 3D viva (trilha, barra superior e painel de fase), sempre com fallback sólido (`rgba(18, 12, 9, 0.92)`), sem empilhar vidro sobre vidro e sem brilho externo difuso.

```css
.hud-flutuante {
  background: rgba(18, 12, 9, 0.82);
  border: 1px solid rgba(255, 248, 231, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 248, 231, 0.16), 0 12px 28px rgba(0, 0, 0, 0.45);
}
```

## Componentes

- **Cabeçalho fixo (`Header`):** barra escura única (`64px` mobile / `72px` desktop) com logo, links simples e `BotaoSacola`.
- **Botão principal:** fundo `#FF6A1A` sólido, texto `#120C09`/`#241812`, altura mínima `44–48 px`. Um por estado ou por contexto real.
- **Botão secundário / opcional:** borda sutil (`#CBBB9F` no claro, `rgba(255,248,231,.25)` no escuro), fundo transparente/escuro discreto.
- **Chips / seleção de opção:** pílula `999px` (no mínimo `44 px` de altura no toque), contraste invertido quando ativo (`aria-pressed="true"`).
- **Trilha de etapas da bancada:** pílula horizontal com ícones dos passos; passo ativo destacado com borda `#FF9A4A`, concluído com marca ouro `#E8B84A`.
- **Comanda:** folha serrilhada pautada (`#FBF5E6`), tipografia mono para itens/preços alinhados e carimbo `#C2410C`.

## Regras locais

- Escala de espaçamento: `4, 8, 12, 16, 24, 32, 48, 64 px`.
- Escala de raios: `8 px` (chips internos / botões menores), `12 px` (botões padrão), `16–22 px` (painéis/cartões), `999px` (pílulas e avatares/contadores).
- Alvos de toque ≥ `44×44 px` no geral e ≥ `48×48 px` nas ações da bancada.
- Zero sobreposição entre barras do HUD, logo e cena da tábua em `360×800`, `390×844` e `1440×900`.
- Zero `overflow-x` em todas as larguras; `prefers-reduced-motion` respeitado.
