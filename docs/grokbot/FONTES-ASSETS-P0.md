# Alhoaria — fontes de assets P0 (mão / ingredientes / cena / melt)

Pesquisa 02/11/2026 ~01:10 (America/Sao_Paulo). Licenças lidas **na fonte** (API Sketchfab `/v3/models/{uid}`, página de licença Poly Haven/ambientCG/Kenney, página do produto Superhive). Onde não deu pra abrir/confirmar → **VERIFY**. Não é parecer jurídico.

## 0. Correção importante (Wawa Sensei)

| Item | O que a fonte diz | Ação |
|---|---|---|
| Modelo **Sandwich assembly** — charalamboscharalambous8 — https://sketchfab.com/3d-models/sandwich-assembly-2ee0a6ea4b7547ad9ced7ec5aade37c9 | **CC Attribution 4.0** (API Sketchfab), downloadable, 21.124 faces, publicado 31/10/2022 | Pode usar comercialmente **com crédito** (autor + link + licença + indicar se modificado). Estilo cartoon/Maya → serve de protótipo, não de food porn |
| Repo **wass08/r3f-wawa-eats** | GitHub API: **sem LICENSE** (`license: null`); nenhum arquivo LICENSE no root; package.json sem campo license | ⚠️ ASSET-LIST dizia "MIT" — **errado**. Sem licença = todos os direitos reservados. Usar só como **referência de padrão** (Zustand + spring stack); não copiar código |

## 1. Tabela P0

Legenda risco: 🟢 baixo · 🟡 médio · 🔴 alto. "CC-BY" = CC Attribution 4.0 (crédito obrigatório, comercial ok, modificar ok).

### Mão do chef

| Nome | URL | Licença (exata) | Uso | Preço | Encaixe | Risco / nota |
|---|---|---|---|---|---|---|
| Blender Studio — Human Base Meshes (inclui **Base Mesh - Hand**) v1.4.1 | https://www.blender.org/download/demo-files/ · zip: https://download.blender.org/demo/asset-bundles/human-base-meshes/ | **CC0** (card "49 MB – CC0") | Comercial ✅ · crédito não | grátis | mão (base realista, quads, UV) | 🟢 Sem rig → rigar (Rigify/manual) + retopo low ≤ ~5k tris. Melhor base "limpa" |
| First Person hands rigged — davidfischer | https://sketchfab.com/3d-models/547a45535f0c4fe787948f7a7a6a88db | **CC Attribution** | Comercial ✅ · crédito ✅ | grátis | mão (já rigada, 8.152 faces) | 🟡 Braços FPS (estilo game); trocar material/luva. Mais rápido pra clip put/remove |
| Rigged Hand — haiku_tutorials | https://sketchfab.com/3d-models/6fa0664093b5489da73cfc6c2dd6e4f3 | **CC Attribution** | Comercial ✅ · crédito ✅ | grátis | mão (rigada, 12.182 faces) | 🟡 Qualidade a conferir no viewer |
| Hand With Gloves — teenjust500 | https://sketchfab.com/3d-models/5a6a434b8ec943ffacc581358781eecb | **CC Attribution** | Comercial ✅ · crédito ✅ | grátis | mão com luva (20.538 faces) | 🟡 Luva "militar/FPS" — retexturizar p/ luva nitrílica preta de cozinha |
| Rigged hand — elenaferfor | https://sketchfab.com/3d-models/eae97cc2a742413cb5338ab942b12c1e | **CC Attribution-ShareAlike** | Comercial ✅ · crédito ✅ · **derivado tem que sair CC-BY-SA** | grátis | mão (1 anim) | 🔴 ShareAlike contamina o GLB derivado → evitar |
| 💲 Realistic Hand (Rigged) — Superhive | https://superhivemarket.com/products/realistic-hand-rigged | **Royalty Free** (Superhive Standard RF) | Comercial ✅ · crédito não · não redistribuir/revender o arquivo | **US$ 10** | mão low-poly (2.428 tris, rig + 5 poses, mapas 4K) | 🟡 Blender 2.7x (antigo — conferir import). Ver risco "GLB na web" §2 |
| 💲 Advanced Hand Rigged — Superhive | https://superhivemarket.com/products/advanced-hand-rig-for-blender-4 | **Royalty Free** | idem | **US$ 10** | mão (56+ bones, 10 poses, L/R) | 🟡 Pode ser pesado; decimar |
| 💲 Realistic Rigged Hand (HandRig) — Superhive | https://superhivemarket.com/products/realistic-rigged-hand | página diz **"Creative Commons"** (Superhive só oferece CC-BY 4.0 p/ assets → provável CC-BY) **VERIFY** no download | Comercial ✅ · crédito provável | **US$ 40** | mão hero (68 bones, base MakeHuman CC0) | 🟡 Requer Blender 5.2; texturas procedurais não exportam → bake |
| 💲 Realistic old man hand (Rigged) — Sketchfab Store | https://sketchfab.com/3d-models/9171af5992b6481fa6438419fa9ca06c | **Standard** (Sketchfab Store) | Comercial ✅ · sem crédito · **proíbe permitir extração como arquivo standalone** | **US$ 15** | mão (6.880 faces) | 🔴 "Old man" + risco web §2 |

### Ingredientes realistas (todos scans CC-BY → decimar/retopo + bake)

| Nome | URL | Licença | Uso | Preço | Encaixe | Risco / nota |
|---|---|---|---|---|---|---|
| BBQ Pork spare ribs — alban | https://sketchfab.com/3d-models/b0c61f97c4a0461eb8ce1bd9d1bde404 | **CC Attribution** | comercial ✅ crédito ✅ | grátis | costela (138k faces, polycam) | 🟡 costela inteira; desfiar = remodelar p/ "costela 6h desfiada" |
| Home-made sandwich — alban | https://sketchfab.com/3d-models/470c868e32f946f3bc70436c9e700af1 | **CC Attribution** | idem | grátis | ref sanduíche/carne (267k) | 🟡 só ref de look/decimar |
| Faux pulled pork sandwich — alban | https://sketchfab.com/3d-models/017a12c2ec5245d68c17634242d5a19b | **CC Attribution** | idem | grátis | pulled pork (69k) | 🟡 é "faux" (veg) mas visual serve |
| Steak Sandwich (Scaniverse LIDAR) — db4 | https://sketchfab.com/3d-models/8a336094472e49819b4c1eb522191130 | **CC Attribution** | idem | grátis | alcatra fatiada (221k) | 🟡 LIDAR = ruído; extrair só camada carne |
| Roasted Meat — too.yulianto | https://sketchfab.com/3d-models/44c81c84860844fbbebbdcc558548420 | **CC Attribution** | idem | grátis | carne genérica low (1.732 faces) | 🟢 leve; tem osso |
| Chicken breast grilled — PaShok3D | https://sketchfab.com/3d-models/2a008655b51c4250907611c56bd8ea68 | **CC Attribution** | idem | grátis | frango (1.624 faces) | 🟢 leve, web-ready |
| (Game-Ready Free) Broccoli — HaVe | https://sketchfab.com/3d-models/37831c39556e472cbd722846573b0e38 | **CC Attribution** | idem | grátis | brócolis (6.108 faces, 4K) | 🟢 |
| Bread group – 3 Photoscaned breads — gamewarming | https://sketchfab.com/3d-models/1b4d051f24b84b65b0f3343006bf0710 | **CC Attribution** | idem | grátis | pão (3.626 faces, gameready) | 🟢 base p/ pão especial topo/base |
| Bun, Brioche Hamburger_whole — tjmartin97 | https://sketchfab.com/3d-models/4b69c8ed28274ede9b5e41bed62bd3ab | **CC Attribution** | idem | grátis | brioche Dogalho (224k) | 🟡 decimar |
| Garlic — mantasT | https://sketchfab.com/3d-models/fccb65d701a54ba2b4874ab94c2be911 | **CC Attribution** | idem | grátis | alho/pasta de alho (42k) | 🟢 |
| Sliced Cheese — CGpub | https://sketchfab.com/3d-models/757aa62e35834a3c9cff3336eb4d33b4 | **CC Attribution** | idem | grátis | queijo fatiado (63k) | 🟢 |
| Poly Haven — hamburger_buns · yellow_onion | https://polyhaven.com/a/hamburger_buns · https://polyhaven.com/a/yellow_onion | **CC0** | comercial ✅ crédito não | grátis | pão / cebola (Onio) | 🟢 melhor risco possível |
| Kenney Food Kit 2.0 | https://kenney.nl/assets/food-kit | **CC0** (kenney.nl/support: "all game assets… CC0") | comercial ✅ | grátis | protótipo low-poly | 🟢 só protótipo (não é food porn) |
| 💲 Bread Roll — eydeet (Sketchfab Store) | https://sketchfab.com/3d-models/bread-roll-c53f8ed9ebac4444bccc3b2435e9f13a | **Standard** | comercial ✅ sem crédito; não permitir extração | **US$ 4,99** | pão (100k) | 🔴 risco web §2 |
| 💲 Garlic Bread — mark.energy (Sketchfab Store) | https://sketchfab.com/3d-models/garlic-bread-e83ae3b593084e53a5480c8ec089bcb3 | **Standard** | idem | **US$ 5** | pão de alho ref (63k) | 🔴 risco web §2 |
| ❌ Garlic Bread with cheese / Pork knuckle — zoltanfood; PULLED-PORK — greggreg | (Sketchfab) | **sem licença de download** (dl=false, license null) | ❌ não usar | — | só ref visual | 🔴 |

### Cena / tábua / luz quente

| Nome | URL | Licença | Uso | Preço | Encaixe | Risco |
|---|---|---|---|---|---|---|
| Poly Haven — wooden_cutting_board | https://polyhaven.com/a/wooden_cutting_board | **CC0** | comercial ✅ crédito não | grátis | tábua | 🟢 **1ª escolha** |
| Poly Haven — wicker_basket_01 · carved_wooden_plate · wooden_spoon · WoodenTable_01/02 | https://polyhaven.com/models | **CC0** | idem | grátis | cesta vime (fotos @alhoaria), props | 🟢 |
| Poly Haven HDRI — **warm_restaurant_night** · warm_bar · warm_restaurant · studio_country_hall (rustic/kitchen) · kiara_interior (kitchen) | https://polyhaven.com/a/warm_restaurant_night (troque o slug) | **CC0** | idem | grátis | HDRI quente p/ `Environment` Drei + bake | 🟢 usar 1k/2k .hdr na web |
| ambientCG — madeira (ex. família `Wood0xx`) | https://ambientcg.com/list?q=wood | **CC0 1.0** (ambientcg.com/license) | idem | grátis | textura tábua/bancada | 🟢 |
| Cutting Board Asset — klessgyzen | https://sketchfab.com/3d-models/9d45f15fb21f4fc89118b2631eec5fda | **CC Attribution** | crédito ✅ | grátis | tábua alternativa (2.536 faces) | 🟢 |

### Queijo melt (opcional)

| Nome | URL | Licença | Uso | Preço | Encaixe | Risco |
|---|---|---|---|---|---|---|
| 💲 Melter v2.0 — 3DSinghVFX (Superhive) | https://superhivemarket.com/products/melter | **Royalty Free**; página: "use in any projects (non-commercial or commercial). You may not redistribute the geometry node group itself" | comercial ✅; exportar **mesh/shape keys baked** ok; não redistribuir o node group | **US$ 7** | melt (GN, Blender 3.6–5.2) → bake em shape keys / morph target GLB | 🟢 o que vai pro site é o resultado, não a ferramenta |
| Shredded cheese melted — Mmmighty_Atom | https://sketchfab.com/3d-models/21c9bb63545845c1b0e514a73b133f9c | **CC Attribution** | crédito ✅ | grátis | camada de queijo gratinado (15.744 faces) | 🟢 |
| Alternativa 0-custo | Blender: Cloth/GN próprio + shape keys | — | — | grátis | melt | 🟢 só tempo |

## 2. Risco "GLB servido na web" (licenças pagas)

- **Sketchfab Standard** §2.2(b)/(h): proíbe disponibilizar o asset "in a way that allows third parties to … download, extract … as a stand-alone file"; §2.7 exige termos no site proibindo republicação. GLB em `public/` é baixável → **🔴 risco** se usado cru. Mitigar: incorporar num GLB combinado/modificado, Draco, + cláusula nos termos — ainda é zona cinza → **VERIFY** jurídico/Igor.
- **CGTrader Royalty Free** §21A.3: em software deve "take all commercially reasonable measures to prevent the end user from gaining access" (ex.: formato proprietário/criptografia). Web GLB dificulta → **🟡/🔴**. Por isso não listei compra CGTrader como 1ª opção.
- **Superhive Standard RF**: só proíbe "resell, redistribute, or repackage" + logo/marca. Menos explícito sobre extração web → **🟡** (mesmo cuidado: GLB derivado/combinado).
- **CC0 / CC-BY**: sem esse problema. CC-BY só exige crédito → criar `/creditos` (ou rodapé do case) com autor, título, link, "CC BY 4.0", "modificado".

## 3. VERIFY (não consegui confirmar na fonte)

1. Superhive **Realistic Rigged Hand (US$ 40)**: "Creative Commons" — qual CC exatamente (provável CC-BY 4.0) e se exige crédito → conferir LICENSE no download/FAQ.
2. **MakeHuman** (saída CC0) — página de licença não abriu; não usar como fonte até confirmar.
3. Qualidade real dos hands CC-BY (deformação, topologia) → abrir viewer Sketchfab antes de baixar.
4. Formatos de download Sketchfab (API pública não expõe `archives` sem login) — conferir se há GLB/FBX/blend.
5. Uso de Sketchfab Standard / CGTrader RF em GLB público na web — decisão Igor (ver §2).

## 4. Recomendação de trilho (ordem de compra/download)

1. **Baixar já (CC0, risco zero):** Poly Haven `wooden_cutting_board`, `hamburger_buns`, `yellow_onion`, `wicker_basket_01` + HDRI `warm_restaurant_night` (e `warm_bar` como B) + madeira ambientCG.
2. **Mão:** base **Blender Human Base Meshes → Base Mesh - Hand (CC0)** → retopo ~3–5k tris + rig próprio + clips put/remove + luva preta. Se precisar de rig pronto hoje: **Superhive Realistic Hand (Rigged) US$ 10** (2.4k tris, low ideal p/ web) ou CC-BY "First Person hands rigged" como atalho.
3. **Ingredientes:** scans CC-BY (frango PaShok3D, brócolis HaVe, pão gamewarming, alho mantasT, costela alban, queijo CGpub) → decimar + bake normal/AO → ≤ 1024 px. Costela desfiada/pulled pork/creme/pasta de alho = **modelar** (nenhuma fonte livre boa).
4. **Melt:** comprar **Melter US$ 7** só se o case precisar do gratinado animado; senão shape keys manuais + "Shredded cheese melted" CC-BY.
5. **Evitar:** CC-BY-SA, modelos sem licença de download (zoltanfood etc.), Sketchfab Store Standard cru na web, código do r3f-wawa-eats (sem licença).
6. Montar `CREDITOS.md` + página de créditos no site antes de qualquer publish (CC-BY).

Custo P0 sugerido: **US$ 10–17** (mão US$ 10 + Melter US$ 7 opcional). Nada comprado — compra exige ok do Igor.
