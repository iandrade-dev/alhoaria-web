# Alhoaria — Brief completo: site + cardápio interativo 3D

> **Pra quem é este documento:** pra um GPT com acesso ao **Blender** e a um ambiente de código. Você vai **modelar os assets 3D** (comida, logo, cenário) e **construir o site + cardápio interativo** da Alhoaria. Tudo o que você precisa está aqui. Onde estiver escrito **VERIFICAR COM O CLIENTE**, não invente — use o valor daqui e deixe marcado no código (comentário `// VERIFY`).
>
> **Anexos:** junto com este .md, anexe a pasta `refs/` (logo-anota.jpg, menu-header.jpg, menu-item-1…8.jpg, ig-profile-shot.png). Os caminhos `refs/...` abaixo apontam pra ela.
>
> Projeto de: **Igor Andrade (@iandradedev)** · Cliente: **Alhoaria (@alhoaria)** · Pesquisa feita em 01/11/2026.

---

## 1. Objetivo do projeto

A Alhoaria é uma lanchonete de Palhoça/São José (SC) que faz **lanches no pão de alho**: sanduíches com pão especial, pasta de alho da casa, creme de queijo artesanal e muito queijo gratinado no maçarico, além de Pizzalho, Mac Cheese, Dogalho, burgers, porções e chopp Lohn. Hoje o cliente descobre tudo pelo Instagram (~18,7 mil seguidores, 331 posts) e pede por um link do Linktree → Anota AI. O objetivo é criar **um site próprio, mobile-first, com um cardápio interativo e heróis 3D** que façam a pessoa sentir o queijo gratinando na tela, escolher o lanche em poucos toques, montar o Mac Cheese do jeito dela e **mandar o pedido pronto pelo WhatsApp (ou seguir pro Anota AI)**. O site tem que parecer a Alhoaria — cozinha escura, madeira, fogo de maçarico, queijo dourado e o logo xilogravura preto e branco — e não um template genérico.

---

## 2. Brand kit

### Logo
- Arquivo de referência: `refs/logo-anota.jpg` (200×200, versão branca sobre preto, tirada do Anota AI). **Baixa resolução — pedir o vetor/PNG em alta ao cliente.**
- Descrição: selo circular estilo **xilogravura/carimbo P&B**. Dentro: queijo, cabeça de alho e pão desenhados à mão; wordmark **ALHOARIA** em caixa alta com serifa grossa; embaixo **PÃO DE ALHO RECHEADO**; laterais **2023** e **Nº01**; um mapinha de **Santa Catarina** no rodapé.
- No Instagram a foto de perfil é a versão "A" (letra A grande com alho e queijo dentro de um círculo rabiscado).
- Destaques do IG formam a palavra **A-L-H-O** em círculos preto e branco — dá pra reaproveitar como sistema de ícones de categoria (letras em círculo, traço de carimbo).
- Uso: sempre P&B (branco sobre fundo escuro ou preto sobre creme). Não colorir o logo, não aplicar gradiente.

### Paleta (proposta — derivada das fotos e das artes do IG; o cliente pode ajustar)
| Token | Hex | Papel |
|---|---|---|
| `--carvao` | `#0A0A0A` | fundo principal (cozinha escura) |
| `--osso` | `#F5F5F0` | texto principal sobre escuro, logo |
| `--creme` | `#FFF8E7` | fundo de cards claros / papel kraft claro / cardápio "de papel" |
| `--ouro` | `#E8B84A` | preço, destaques, bordas ativas |
| `--queijo` | `#F0C75E` | brilho do queijo, hover, ilustrações |
| `--macarico` | `#FF6A1A` | CTA principal (Pedir), fogo, alertas quentes |
| `--madeira` | `#5C3D2E` | tábuas, divisórias, fundo de seções secundárias |

Regras: o laranja (`--macarico`) é **o único acento forte** — use pra CTA e fogo, não espalhe. Ouro/queijo pra preço e brilho. Fundo sempre carvão → madeira, nunca roxo/azul.

### Tipografia (sugestão)
- **Display:** condensada e pesada, como as artes "HOJE TEM" do IG → `Anton` (Google Fonts) ou `Archivo Black`. Caixa alta só em títulos curtos.
- **Texto/UI:** `Archivo` (variável) ou `Inter`, 16–18 px no mobile.
- **Acento manuscrito (opcional, com moderação):** `Caveat` pra anotações tipo "sextou", "kkkk", setas desenhadas.

### Fotografia e textura
- Fotos reais de comida: luz quente, queijo dourado com pontos tostados de maçarico, tábua de madeira, cestinha de vime, papel manteiga, latinha ao lado.
- Artes do IG: tipografia preta pesada repetida ("HOJE TEM" x5), gradiente laranja de fogo, letreiro manuscrito branco ("sextou").
- Ambiente da loja: madeira ripada, luz amarela, logo pintado na parede, "um ambiente acolhedor para toda a família".

---

## 3. Unidades, contatos, horários e links

| | Pedra Branca (Palhoça) | Kobrasol (São José) | Praia de Fora |
|---|---|---|---|
| Endereço | R. das Cegonhas, 19 — Pedra Branca, Palhoça/SC | R. Koesa, 115 — Kobrasol, São José/SC | **Em breve** (endereço a confirmar) |
| Mapa | buscar "Alhoaria Pedra Branca" (link exato: VERIFICAR) | https://maps.app.goo.gl/fmz4aZ3uvBp7bXK68 | — |

- **Horário (agregadores):** segunda a sábado, 18:30–00:00 · domingo fechado. **VERIFICAR** se vale pras duas unidades.
- **Telefone (agregadores):** +55 48 99970-2016 → **VERIFICAR** se é o WhatsApp oficial de pedidos e de qual unidade.
- **Instagram:** https://www.instagram.com/alhoaria/
- **Linktree:** https://linktr.ee/alhoaria
- **Cardápio/pedido online (Anota AI):** https://pedido.anota.ai/loja/alhoaria?f=msa
- **Serviço:** delivery, retirada e salão.
- **Parceria:** chopp **Lohn** ("O melhor sanduíche agora tem o melhor chopp").

---

## 4. Cardápio completo

> ⚠️ **Preços raspados do Anota AI em 01/11/2026 — VERIFICAR COM O CLIENTE antes de publicar.** Guarde os preços num único arquivo de dados (`data/menu.json`) pra o cliente atualizar sem mexer no layout. "desde" = preço inicial, varia por tamanho/opção.

**Todo sanduíche no pão de alho leva:** pão especial, pasta de alho exclusiva, creme artesanal de queijo e muito queijo gratinado.

Fotos de referência disponíveis (baixa resolução, 200 px, só pra referência de modelagem/composição): `refs/menu-header.jpg` (sanduíche de costela aberto + dadinhos na tábua, 800×200), `refs/menu-item-1.jpg` … `menu-item-8.jpg`.

| Categoria | Item | Descrição | Preço | Foto ref |
|---|---|---|---|---|
| Sanduíches | **A Costela!** | Costela cozida 6h, desfiada | R$ 44,90 | `menu-header.jpg` |
| Sanduíches | **Frango!** | Filé de sobrecoxa | R$ 33,90 | — |
| Sanduíches | **Mr. Alcatra!** | Alcatra | R$ 48,90 | — |
| Sanduíches | **Brócolis & Queijo!** | Vegetariano | R$ 33,90 | — |
| Sanduíches | **Pulled Pork!** | Pernil cozido 4h, desfiado | R$ 35,90 | — |
| Sanduíches | **Dogalho** | Pão brioche, 2 salsichas, ketchup, mostarda, fondue 4 queijos, mussarela, batata palha | R$ 26,90 | `menu-item-7.jpg` |
| Combos | Clássico + Bebida | Sanduíche + bebida | R$ 45,72 | — |
| Combos | Trio Alhoaria | Sanduíche + acompanhamento + bebida (VERIFICAR composição) | R$ 55,90 | `menu-item-5.jpg` |
| Combos | Trio Casal | (VERIFICAR composição) | R$ 75,90 | `menu-item-4.jpg` |
| Combos | Trio Dogalho | Dogalho + batata + bebida (VERIFICAR) | R$ 36,90 | `menu-item-1.jpg` |
| Combos | Duplo Pizzalho + Pureza | 2 Pizzalhos médios + Pureza 1,5 L | R$ 99,90 | `menu-item-2.jpg` |
| Burgers (lançamento) | Clássico | Blend 150 g, maionese de alho defumada | R$ 16,00 | — |
| Burgers (lançamento) | Salada | Blend 150 g, salada, maionese de alho defumada | R$ 16,90 | — |
| Burgers (lançamento) | Onio | Blend 150 g, onion rings, maionese de alho defumada | R$ 28,90 | `menu-item-6.jpg` |
| Pizzalho | Pizzalho 4 pedaços | Pizza no pão de alho (sabores: VERIFICAR) | desde R$ 34,90 | `menu-item-8.jpg` |
| Pizzalho | Pizzalho 6 pedaços | idem | desde R$ 44,90 | `menu-item-3.jpg` |
| Pizzalho | Pizzalho 8 pedaços | idem (aceita 2 sabores — VERIFICAR) | desde R$ 69,90 | — |
| Pizzalho | Pizzalho Calabresa 6 fatias | Calabresa | R$ 45,90 | — |
| Porções | Isca de frango + batata | — | desde R$ 39,90 | — |
| Porções | Onion rings | — | desde R$ 29,90 | — |
| Porções | Almôndega + batata | 800 g | R$ 59,90 | — |
| Porções | Batata rústica | — | desde R$ 24,90 | — |
| Porções | Batata frita | — | desde R$ 19,90 | — |
| Porções | Mix onion + rústica | Onion rings + batata rústica | desde R$ 47,90 | — |
| Porções | Dadinho de tapioca | — | desde R$ 29,90 | `menu-header.jpg` (dadinhos) |
| Mac Cheese | **Mac Cheese Alhoaria** | Monte o seu: massa (penne ou espaguete) + molho (4 queijos, cheddar defumado ou alho e azeite) + proteínas adicionais | desde R$ 19,90 | — |
| Chopp Lohn | Chopp 1 L | Lohn | R$ 15,00 | — |
| Chopp Lohn | Caneca 500 ml | Lohn | R$ 9,90 | — |
| Cervejas Lohn | Lager 600 ml | Lohn | R$ 12,00 | — |
| Cervejas Lohn | Lager 355 ml | Lohn | R$ 8,00 | — |
| Cervejas Lohn | Ultra sem glúten | Lohn | R$ 10,00 | — |
| Bebidas | Refrigerantes / águas | Lata, garrafa, água (lista exata: VERIFICAR) | R$ 5,00–10,00 | — |
| Bebidas | Soda italiana | — | R$ 14,90 | — |

Itens citados em reviews/agregadores antigos, **não confirmados no cardápio atual** (não publicar sem o cliente confirmar): Brisket, Linguiça Parrillera de Cordeiro, Batata Smile, Pizza doce 6 pedaços, Pudim no copo (tradicional e com doce de leite), Long Cheese com goiabada, Milk-shake (desde R$ 19,90).

---

## 5. Escopo do SITE (landing + cardápio interativo)

**Princípios:** mobile-first (390 px é o tamanho de referência), pt-BR, carregamento rápido no 4G, estética **cozinha escura e quente** (carvão, madeira, fogo de maçarico, queijo dourado). Nada de roxo, nada de gradiente "IA", nada de cara de SaaS.

### 5.1 Home — hero 3D
- Hero full-screen com o **pão de alho recheado de costela em 3D** (GLB do Blender), aberto, queijo gratinado com brilho, girando devagar (≤ 20°/s) sobre uma tábua de madeira; o usuário pode arrastar pra girar (OrbitControls limitados: só eixo Y, ±35° em X).
- Um "fio" de fumaça/vapor leve e um brilho de maçarico que passa uma vez sobre o queijo no load (shader de emissão laranja animado, 1,2 s).
- Título curto (ver §10) + 2 CTAs: **Ver cardápio** (primário, `--macarico`) e **Pedir agora** (secundário, abre WhatsApp/Anota).
- Fallback: se WebGL falhar ou `prefers-reduced-motion`, mostra a foto/poster render do Blender (PNG/WebP) — sem 3D.

### 5.2 Unidades / mapa
- Duas cards: **Pedra Branca** e **Kobrasol**, com endereço, horário, botão "Como chegar" (Google Maps) e botão "Pedir desta unidade".
- Mapa estático estilizado (tons carvão/madeira, pin com o selo do logo) — nada de iframe pesado no load; iframe do Maps só ao tocar.
- Indicador "Aberto agora / Fecha às 00:00" calculado pelo horário (seg–sáb 18:30–00:00, fuso America/Sao_Paulo).

### 5.3 Cardápio interativo (o coração do projeto)
- **Categorias** em abas horizontais com scroll e indicador que anima pelas bordas (a borda da frente vai primeiro): Sanduíches · Combos · Burgers · Pizzalho · Porções · Mac Cheese · Lohn · Bebidas.
- **Card do item:** foto (ou render 3D estático), nome, descrição curta, preço em `--ouro` com algarismos tabulares, botão "+".
- **Drawer de detalhe** (bottom sheet, arrasta pra fechar):
  - Topo: **modelo 3D girável** do item quando existir GLB (Costela/sanduíche, Dogalho, Pizzalho, Mac Cheese, dadinho, batata); senão foto.
  - Lista "Vai no lanche": pão especial, pasta de alho, creme de queijo, queijo gratinado + ingrediente do item.
  - Observações (texto livre: "sem cebola", etc.), quantidade (− 1 +), botão **Adicionar · R$ 44,90**.
- **Mac Cheese — monte o seu:** passo a passo dentro do drawer (sem círculos numerados 1-2-3): Massa (penne / espaguete) → Molho (4 queijos / cheddar defumado / alho e azeite) → Proteínas (lista e preços: VERIFICAR). Preço atualiza em tempo real. Uma tigela 3D troca a massa/cor do molho conforme a escolha (variantes de material no GLB).
- **Pizzalho:** escolher tamanho (4 / 6 / 8 pedaços) e sabor(es); 8 pedaços permite 2 sabores (VERIFICAR).
- **Carrinho** fixo no rodapé ("2 itens · R$ 64,80 · Ver pedido"). Persistir em `localStorage`.
- **Checkout = WhatsApp ou Anota:**
  - Opção A (padrão): montar mensagem e abrir `https://wa.me/5548999702016?text=<pedido codificado>` (**número VERIFICAR**), escolhendo a unidade. Formato da mensagem:
    ```
    Oi, Alhoaria! Quero fazer um pedido 🧄
    Unidade: Pedra Branca
    1x A Costela! — R$ 44,90
    1x Mac Cheese (penne, cheddar defumado) — R$ 19,90
    Total: R$ 64,80
    Nome:
    Entrega ou retirada:
    ```
  - Opção B: botão "Pedir pelo Anota AI" → https://pedido.anota.ai/loja/alhoaria?f=msa (link externo, sem embed obrigatório; embed só se o Anota permitir iframe).
- Dados do cardápio em `data/menu.json` (id, categoria, nome, descrição, preço, desde:boolean, foto, glb, modificadores, verify:boolean). Itens `verify:true` aparecem com um aviso discreto só em ambiente de dev.

### 5.4 Combos
- Seção horizontal com os 5 combos, foto real + preço; toque abre o drawer do combo com a composição (VERIFICAR composição exata de cada).

### 5.5 Parceria Lohn
- Faixa escura com a caneca de chopp (foto ou render simples), copy "O melhor sanduíche agora tem o melhor chopp." e os preços Lohn. Respeitar a marca Lohn (pedir logo oficial). Aviso "Beba com moderação" e +18.

### 5.6 Em breve — Praia de Fora
- Teaser simples: "Em breve na Praia de Fora" + botão "Me avisa quando abrir" (abre DM do IG ou WhatsApp — não coletar dados sem o cliente definir LGPD).

### 5.7 Rodapé
- Logo P&B, Instagram, Linktree, horários, endereços, "Site por @iandradedev".

### Requisitos técnicos
- Lighthouse mobile ≥ 85 em performance; LCP < 2,5 s no 4G (carregar o GLB do hero **depois** do poster).
- Acessibilidade: contraste AA, foco visível, todos os botões com label, `prefers-reduced-motion` desliga rotação automática e o brilho do maçarico.
- SEO local: título "Alhoaria — Lanches no pão de alho · Palhoça e São José", `schema.org/Restaurant` com as duas unidades, horários e `menu` (sem `aggregateRating` inventado).
- Open Graph com render do sanduíche.

---

## 6. Brief Blender — assets pra modelar

**Estilo geral:** comida **fotorreal**, luz principal quente (≈ 3200 K) vindo de cima/esquerda, rim light laranja suave (maçarico), fundo escuro. Queijo com **leve brilho** (roughness 0,35–0,45, subsurface amarelado), pontos tostados escuros (textura/displacement). Pão com crosta dourada e miolo aerado. Referência de composição: `refs/menu-header.jpg` e `refs/menu-item-*.jpg`.

| # | Asset | Descrição | Uso no site |
|---|---|---|---|
| 1 | **Pão de alho gratinado com costela (hero)** | Pão especial cortado ao meio na horizontal, aberto em "V", costela desfiada escura transbordando, creme de queijo branco escorrendo, cobertura de queijo gratinado com manchas de maçarico | Hero da home + drawer "A Costela!" |
| 2 | **Dogalho** | Pão brioche, 2 salsichas, cobertura de fondue 4 queijos + mussarela gratinada, batata palha por cima, em cestinha de vime com papel manteiga (ref `menu-item-7.jpg`) | Drawer + card |
| 3 | **Pizzalho com queijo no maçarico** | Pizza retangular/quadrada sobre base de pão de alho, cortada em pedaços, queijo borbulhando; variante com maçarico + chama (emissão laranja) (ref `menu-item-3/8.jpg`) | Seção Pizzalho + animação |
| 4 | **Tigela de Mac Cheese** | Tigela escura com penne em molho cremoso; variantes de material: 4 queijos (creme claro), cheddar defumado (laranja), alho e azeite (brilho oleoso, alho dourado); variante espaguete | Monte-o-seu |
| 5 | **Dadinho de tapioca** | Cubos dourados, crocantes, 6–8 unidades + potinho de molho | Porções |
| 6 | **Batata (frita e rústica)** | Porção em cone/caixinha kraft | Porções |
| 7 | **Selo do logo em 3D** | Carimbo circular do logo em relevo (preto fosco sobre madeira ou metal escovado); pode virar loader do site | Loader, rodapé, favicon 3D |
| 8 | **Tábua de madeira** | Tábua rústica com veios marcados, bordas gastas — base reutilizada por todos os itens | Cenário |
| 9 | **Saco kraft de delivery** | Saco de papel kraft com o selo do logo carimbado em preto, dobrado no topo | Seção pedido/delivery |

**Especificações de export:**
- Formato **GLB** (glTF 2.0) com compressão **Draco**; texturas **KTX2/Basis** ou WebP, máx. 2048 px (heróis) / 1024 px (secundários).
- **LODs:** LOD0 (hero, ~50–80k tris), LOD1 (~15k), LOD2 (~3k) pra mobile fraco.
- Tamanho alvo: **2–5 MB por hero**, ≤ 1,5 MB pros secundários.
- PBR metallic-roughness; bake de AO; origem no centro da base; escala real (1 unidade = 1 m); eixo Y pra cima.
- Também exportar: **poster PNG/WebP 1600 px** de cada item (render Cycles, fundo transparente) pra fallback e Open Graph; e **turntable MP4** curto do hero (opcional, redes).
- Nomear: `alhoaria-costela-hero.glb`, `alhoaria-dogalho.glb`, `alhoaria-pizzalho.glb`, `alhoaria-mac-cheese.glb` (com variantes `KHR_materials_variants`), `alhoaria-dadinho.glb`, `alhoaria-batata.glb`, `alhoaria-selo.glb`, `alhoaria-tabua.glb`, `alhoaria-kraft.glb`.

---

## 7. Stack sugerida

- **Next.js** (App Router) + TypeScript + CSS Modules ou Tailwind com tokens da §2.
- **Three.js via React Three Fiber** + `@react-three/drei` (`useGLTF` com Draco/KTX2, `PresentationControls`, `Environment` com HDRI quente) para os heróis. Alternativa aceitável: **Spline** só pro hero, se for mais rápido.
- Animação de UI: Framer Motion (springs contidas, sem bounce exagerado).
- Carrinho: Zustand + `localStorage`.
- Checkout: link `wa.me` com mensagem pré-preenchida **ou** link para o Anota AI. Sem backend de pagamento nesta fase.
- Deploy: Vercel. Imagens via `next/image` (WebP/AVIF).
- **Proibido:** avaliações, notas, "4.9 ★", número de pedidos, depoimentos ou contagem de seguidores inventados. Se o cliente quiser prova social, usar só posts reais do IG com autorização.

---

## 8. Anti-tells de UI (o que NÃO fazer)

- ❌ Gradiente roxo/azul "de IA", glassmorphism, glow neon.
- ❌ Emoji no lugar de ícone (🧄 pode aparecer **na copy de WhatsApp/Instagram**, nunca como ícone de UI). Ícones = traço de carimbo/xilogravura no estilo do logo, ou as letras A-L-H-O em círculo dos destaques.
- ❌ Seção "Como funciona" com círculos numerados 1-2-3.
- ❌ Chips/labels em caixa alta monoespaçada ("NEW", "POPULAR"), badges com bolinha pulsando.
- ❌ Eyebrow acima do título, palavra do título em outra cor/gradiente, card com borda colorida lateral, pill em tudo.
- ❌ Números de prova social inventados ("+10 mil pedidos", "4,9 estrelas").
- ❌ Fotos de banco genéricas. Usar **logo real P&B + fotos reais da Alhoaria + renders do Blender**.
- ✅ Fundo carvão com textura sutil de madeira/papel, tipografia pesada condensada, laranja só no CTA e no fogo, preço em dourado, fotos grandes e quentes.

---

## 9. Entregáveis esperados do GPT

1. **Repositório do site** (Next.js) pronto pra deploy na Vercel, com `data/menu.json` editável.
2. **GLBs** de todos os assets da §6 (+ LODs) e os **posters** PNG/WebP; arquivo `.blend` fonte de cada um.
3. **README.md**: como rodar, como trocar preço/item no `menu.json`, como trocar o número do WhatsApp, como substituir um GLB, lista de itens `VERIFY`.
4. **Screenshots** mobile (390×844) e desktop (1440×900) de: home/hero, unidades, cardápio (cada categoria), drawer da Costela, Mac Cheese montado, carrinho, mensagem do WhatsApp gerada.
5. Relatório Lighthouse mobile.

---

## 10. Tom de copy (voz da Alhoaria)

Casual, de família, com humor ("kkkk"), muito "queijo", fogo e alho. Usa 🧄🔥 no Instagram/WhatsApp. Hashtags: #Alhoaria #paodealho. Slogans reais: **"LANCHES NO PÃO DE ALHO!"**, **"Sabor da Alhoaria"**, **"O melhor sanduíche agora tem o melhor chopp."**

**Headlines (sugestões):**
1. "Lanche bom é no pão de alho. O resto é pão."
2. "Queijo gratinado no maçarico, na sua frente (quase)."
3. "Costela 6 horas. Paciência a gente tem, kkkk."

**CTAs (sugestões):**
1. "Montar meu pedido"
2. "Manda pro WhatsApp"
3. "Hoje tem? Tem. Pedir agora"

---

## 11. Gaps / perguntas abertas pro cliente

1. **WhatsApp oficial de pedidos** — o +55 48 99970-2016 é de qual unidade? Cada unidade tem número próprio?
2. **Preços** — confirmar todos (raspados do Anota AI em 01/11/2026), especialmente "desde" das porções e o Clássico + Bebida (R$ 45,72, valor quebrado).
3. **Mac Cheese** — preço exato por massa/molho e lista + preço das **proteínas adicionais**.
4. **Pizzalho** — lista completa de **sabores**, se 4/6 aceitam 2 sabores, e pizza doce (ainda existe?).
5. **Combos** — composição exata do Trio Alhoaria, Trio Casal, Trio Dogalho e Clássico + Bebida.
6. **Fotos oficiais em HD** de cada item + **logo em vetor** (as refs são 200 px).
7. **Lohn** — autorização e logo oficial pra seção de parceria.
8. **Praia de Fora** — endereço e previsão de abertura.
9. **Horário** — igual nas duas unidades? Feriados?
10. **Checkout** — preferem WhatsApp, Anota AI, ou os dois? Taxa de entrega/área atendida?
11. Itens antigos (Brisket, Linguiça de cordeiro, Batata Smile, pudins, milk-shake, Long Cheese) — ainda estão no cardápio?
12. Domínio (ex.: alhoaria.com.br) — já existe?
