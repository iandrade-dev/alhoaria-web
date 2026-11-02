# Alhoaria — asset list v2 + licenças

Atualizado 02/11/2026 (America/Sao_Paulo). Pesquisa fechada o suficiente pra modelar; gaps do cliente ficam VERIFY.

## Estado do MVP (repo `iandrade-dev/alhoaria-web`)

| Peça | Status |
|------|--------|
| Site Next + cardápio + carrinho + WA | ✅ no `main` |
| Hero 3D | ⚠️ procedural Three.js (não GLB food porn) |
| Builder sanduíche + Rapier + mão | ✅ `SandwichKitchen` / `KitchenCanvas` |
| Kit GLB ingredientes | ✅ `public/assets/models/alhoaria-ingredientes.glb` (~2,6 MB) |
| Mão chef GLB | ✅ `alhoaria-mao-chef.glb` (~220 KB) |
| Script Blender montagem | ✅ `blender/montar_alhoaria_blender.py` |
| R3F / Drei | ❌ ainda Three cru |
| Hero Costela / Dogalho / Pizzalho / Mac GLBs | ❌ |
| Cena cozinha + tábua dedicada | ❌ (só o que está no kit/procedural) |
| ui-humanizer pass | ⏳ |
| Deploy / publish | ⛔ sem ok explícito do Igor |

Último commit relevante: `feat: integrar montagem ao vivo do sanduiche 3D com fisica Rapier e mao do chef` (02/11 ~00:20 BRT).

## Assets a produzir (prioridade v2)

### P0 — case “mão do chef”

1. **Refinar mão chef** — rig + clip put/remove; LODs; luvas/pele realista; ≤ 400 KB Draco  
2. **Ingredientes cardápio real** — costela, frango, alcatra, brócolis, pulled pork, pasta alho, creme, gratin, pão especial (topo/base); substituir/estender o kit atual  
3. **Tábua + luz de cozinha** — prop reutilizável + HDRI quente / bake  
4. **Stack spring** — manter Rapier só se colisão pedir; senão React Spring na pilha (ver REFS-3D)

### P1 — heróis food porn

5. `alhoaria-costela-hero.glb` (+ poster WebP)  
6. `alhoaria-dogalho.glb`  
7. `alhoaria-pizzalho.glb` (variante maçarico)  
8. `alhoaria-mac-cheese.glb` (KHR_materials_variants: massa + molhos)  
9. Dadinho + batata (porções)

### P2 — marca / cena

10. Selo logo 3D (`alhoaria-selo.glb`)  
11. Saco kraft delivery  
12. Props cozinha (maçarico, cestinha vime) se budget permitir

Specs: GLB + Draco; texturas ≤ 2048 hero / 1024 secundário; LODs; Y-up; 1u=1m; posters 1600 px fundo transparente.

## Refs técnicas (inspiração — NÃO copiar mesh/texture)

| Ref | Licença / uso | Papel |
|-----|---------------|-------|
| [wass08/r3f-wawa-eats](https://github.com/wass08/r3f-wawa-eats) | **Sem LICENSE** (não é MIT) — só ref de padrão; não copiar código. Modelo Sketchfab "Sandwich assembly" = **CC BY 4.0** (crédito) | Padrão Zustand + spring stack |
| [build-burger.vercel.app](https://build-burger.vercel.app/) | site demo — só UX | Preview ao clicar |
| [eboysen/how-2-sandwich](https://github.com/eboysen/how-2-sandwich) | ver LICENSE no repo | Custo de modelar ingredientes |
| [AlanCasal/threejs-fiber-things](https://github.com/AlanCasal/threejs-fiber-things) | ver LICENSE | Orbit + transição |
| My Royal Chef pizza maker | proprietário — **só UX** | Pedido texto → WhatsApp |
| Luigi’s Pizza House (Wavedash) | jogo — **só UX** | Topping à mão |
| Ten Minute Physics soft bodies | código demo (Matthias Müller) — ver aviso no site | Squash; **não** default mobile |
| Kenney Food Kit | CC0 | Só protótipo low-poly |
| Melter (Superhive) | asset pago — comprar se usar | Queijo melt GN |
| Fotos/reels @alhoaria | marca do cliente — uso no case com autorização do Igor/cliente | Refs de look + reel foodporn |
| Logo Anota / menu thumbs 200 px | baixa res do cardápio online — **pedir vetor/HD ao cliente**; não republicar como asset final | Brand + composição |

## VERIFY com cliente (bloqueia publish, não bloqueia modelar)

WhatsApp oficial · preços Anota 01/11 · Mac proteínas · sabores Pizzalho · composição combos · logo vetor + fotos HD · Lohn logo · Praia de Fora · domínio.

## Próximo gate

Escolher um trilho:
- **Modelo** — mão + ingredientes reais + LODs (OpenCode `@alhoaria-modelo` / Blender no PC Igor)
- **Física/anim** — spring stack + clips da mão no site
- **Front** — migrar hero/builder pra R3F+Drei, ui-humanizer, WhatsApp polish
- **QA** — mobile mid-range + fallback + lista VERIFY

Regra: **não publicar** sem ok explícito do Igor.

## Fontes P0 (pesquisa)

Detalhe + tabela de licenças: [FONTES-ASSETS-P0.md](./FONTES-ASSETS-P0.md) (02/11/2026 ~01:10 BRT).

- **Correção:** `wass08/r3f-wawa-eats` **não tem LICENSE** (não é MIT) → só referência de padrão. Modelo "Sandwich assembly" (Sketchfab) = **CC BY 4.0** confirmado → crédito obrigatório.
- **Cena/luz CC0:** Poly Haven `wooden_cutting_board`, `hamburger_buns`, `wicker_basket_01` + HDRI `warm_restaurant_night` / `warm_bar`; madeira ambientCG.
- **Mão:** Blender Human Base Meshes (Hand, CC0) → rig próprio; atalho pago Superhive "Realistic Hand (Rigged)" US$ 10 (RF).
- **Ingredientes:** scans Sketchfab CC-BY (frango, brócolis, pão, alho, costela, queijo) → decimar/bake; costela desfiada/pulled pork/pasta/creme = modelar.
- **Risco:** Sketchfab Store Standard e CGTrader RF proíbem permitir extração do arquivo → GLB público na web é zona cinza; preferir CC0/CC-BY. Criar página de créditos antes do publish.
