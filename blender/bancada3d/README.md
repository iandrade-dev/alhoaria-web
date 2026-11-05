# Bancada 3D da Alhoaria (LAR-429 / B1)

Modelos do lanche "A Costela!" e da tábua, gerados por script no Blender, em GLB leve para three.js / R3F.
Tudo sai de um único script reproduzível: `build_bancada.py` (modelagem procedural em Python puro, sem
downloads). Rodar de novo do zero gera os mesmos arquivos.

## Como rodar

Blender 5.2 (testado no 5.2.1 LTS), sem interface:

```
blender.exe -b --factory-startup -P blender/bancada3d/build_bancada.py -- [opções]
```

Opções:

| opção | efeito |
|---|---|
| `--renders DIR` | pasta dos PNGs de revisão (fora do repo). Padrão: `\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-429-modelos-a2\renders` |
| `--parts a,b` | constrói/exporta só essas peças (padrão: todas; `none` só renderiza a partir dos GLBs existentes) |
| `--views 10,04` | renderiza só essas vistas (`01`..`14`, `poster`; `none` não renderiza) |
| `--quick` | renders de 600 px, poucas amostras (iteração) |
| `--no-poster` | não gera o poster |

Saídas:

- `public/assets/models/bancada/*.glb` (8 arquivos)
- `public/assets/bancada/lanche-pronto.webp` (poster, 1600 px, mesmo enquadramento do render 10: o pão ocupa ~66 % da largura)
- `DIR/01-tabua.png` ... `08-macarico.png`, `09-macarico-chama.png` (extra), `10-montado.png`,
  `11-explodido.png`, `12-close-costela.png`, `13-aberto-recheado.png`, `14-tampa-fechada.png` (encaixe da tampa entreaberta ~17°, vista lateral) (EEVEE, 1200 px). Os renders são feitos reimportando os GLBs
  exportados, ou seja, mostram o que o site recebe.

## Contrato técnico

- glTF binário (`.glb`), Y para cima, 1 unidade = 1 m, transformações aplicadas, compressão Draco ligada
  (`KHR_draco_mesh_compression`). Sem luzes e sem câmeras.
- Espaço comum: todas as camadas já estão na posição montada. Origem do mundo = centro do topo da tábua
  (topo em y = 0). Carregar todos os GLBs na origem mostra o lanche montado na tábua. O pão tem 0,30 m no
  eixo X, centrado em x = 0, z = 0 (largura ~0,10 m, altura ~0,084 m fechado). A tábua vai de x = -0,21 a 0,33 (com cabo)
  e z = -0,15 a 0,15 (z do glTF = -y do Blender).
- Cada arquivo tem um nó raiz com o nome da peça: `tabua`, `pao`, `pasta`, `costela`, `creme`, `mussarela`,
  `gratinado`, `macarico`.
- `macarico.glb`: o nó `macarico` contém os meshes do corpo e o objeto `chama` (cone azul na base e laranja na
  ponta, materiais emissivos), separado para o site mostrar/esconder. O maçarico fica **em pé** na tábua
  (lata de gás laranja na base, cabeça com gatilho e botão vermelho, bico de aço curvo; ~0,15 m de altura), na
  frente-esquerda do pão: base em x ≈ -0,186, z(glTF) ≈ +0,114, com o bico apontando para o pão (+x e -z). O cone
  `chama` sai do fim do bico, inclinado ~40° para baixo.
- Cores: cores de vértice (`COLOR_0`, atributo `Col`) multiplicadas por um material Principled simples
  (pasta, creme, mussarela, gratinado). A tábua usa uma textura JPEG 512x512 embutida (madeira, veio sugerido).
  O pão usa 2 materiais (casca e miolo), cada um com textura de cor + normal map JPEG 512x512 embutidos (poros
  da casca; alvéolos do miolo) multiplicados pela cor de vértice (`COLOR_0` já traz o tom de tostado). A costela
  usa 1 textura de fibras (cor cinza + normal, 256x256) multiplicada pela cor de vértice. O maçarico usa
  materiais de cor sólida (`COLOR_0` branco). Ligue `vertexColors` no material do
  three.js (o GLTFLoader já faz isso quando há `COLOR_0`).
- Mussarela e creme têm material com brilho (roughness baixa; a mussarela usa `KHR_materials_clearcoat`).

## Pão cortado ao meio (base + tampa articulada)

O pão é cortado na horizontal (plano y = 0,042 m, no glTF) e chega meio aberto, como no vídeo do hero.
`pao.glb` tem o nó raiz `pao` com dois filhos:

- `pao_base`: metade de baixo, miolo para cima (levemente côncavo), na posição final.
- `pao_tampa`: metade de cima, casca dourada. O pivô do nó fica na linha da dobradiça: a aresta longa de trás
  (z negativo) no topo da base, em `translation = (0, 0.042, -0.052)`, eixo de rotação = X. A tampa é exportada
  na pose **ABERTA**: `rotation.x = -110°`, ou seja, **-1,9199 rad** (quaternion `(-0.8192, 0, 0, 0.5736)`;
  constante `OPEN_RAD` / `HINGE_DEG = 110` no script).
- **Para FECHAR a tampa**: levar a rotação X local de -1,9199 rad até **0** (equivale a girar +1,9199 rad,
  `+110°`, em torno de X local). Em 0 a tampa assenta sobre o recheio (o miolo da tampa tem uma cavidade que
  "aperta" levemente a costela e o creme).
- `pasta`, `costela` e `creme` ficam sobre o miolo da BASE (a costela transborda um pouco pelas bordas).
- `mussarela` e `gratinado` já estão na posição de tampa **FECHADA** (por cima da tampa, escorrendo pelas
  laterais). O site só deve mostrá-las depois de fechar a tampa (com a tampa aberta elas flutuam no ar).

Renders de revisão: `10-montado.png` = lanche fechado com mussarela gratinada; `13-aberto-recheado.png` = tampa
aberta, base com pasta + costela + creme; `11-explodido.png` = base, pasta, costela, creme, tampa (fechada),
mussarela, gratinado.

## Camadas (ordem vertical, de baixo para cima)

`tabua` -> `pao_base` -> `pasta` -> `costela` -> `creme` -> `pao_tampa` (fechada) -> `mussarela` -> `gratinado`. O `gratinado` é um decalque
fino apoiado ~0,9 mm acima da mussarela (não tem z-fighting a distâncias normais; se a câmera ficar muito longe,
aumente o `near` ou use `polygonOffset` no material).

## Tamanho e triângulos (resultado do script)

| arquivo | tamanho | triângulos |
|---|---:|---:|
| tabua.glb | 50.160 B (49.0 KB) | 2.852 |
| pao.glb | 264.396 B (258.2 KB) | 15.824 |
| pasta.glb | 25.384 B (24.8 KB) | 4.434 |
| costela.glb | 257.352 B (251.3 KB) | 27.108 |
| creme.glb | 26.176 B (25.6 KB) | 8.328 |
| mussarela.glb | 59.348 B (58.0 KB) | 14.676 |
| gratinado.glb | 35.636 B (34.8 KB) | 11.610 |
| macarico.glb | 24.136 B (23.6 KB) | 6.484 |
| **soma** | **742.588 B (725 KB)** | **91.316** |

Orçamento: cada GLB <= 300 KB, soma <= 1,2 MB, peça <= 20 mil triângulos (costela <= 30 mil).
Poster: `lanche-pronto.webp`, 112 KB (<= 200 KB).

## Notas de modelagem

- Pão: loft de 92 secções (superelipse que afina nas pontas) cortado em duas metades, base e tampa. Miolo com
  alvéolos (relevo suave na malha + normal map/cor de textura tileável gerados por script) e casca com poros e
  bolhas (textura + normal) sob a cor de vértice de tostado. Casca e miolo são primitivos separados no glTF
  (2 materiais); na linha do corte as duas superfícies têm vértices próprios (aresta viva).
- Costela: ~450 tiras achatadas (seção elíptica de 4 lados, largura/espessura variáveis, algumas largas) agrupadas
  em ~100 feixes de 3 a 5 tiras paralelas, com curvatura comum, torção, pontas escuras tostadas e camadas em alturas
  diferentes sobre um miolo escuro irregular (nunca aparece base lisa). Textura de fibras (estrias ao longo da tira)
  e normal map dão o aspecto de carne desfiada. As tiras das bordas correm ao longo do pão e escorrem um pouco.
- Creme: fio serpenteante (passa pelo centro sem cobri-lo) com bolsões ocasionais; mussarela: placa grossa de
  borda irregular com línguas e gotas (tubos) pela lateral.
- Gratinado: manchas de formas variadas em aglomerados, do âmbar na borda ao quase queimado no centro.
- Maçarico: superfícies de revolução (lata laranja com faixa preta, ombro e colar de aço), cabeça cilíndrica
  laranja com capa traseira preta, botão vermelho, gatilho (superelipsoide), bico em tubo curvo e cabeça do queimador.
- Funções analíticas compartilhadas (`bprof`, `zouter`, `zface`, `zunder`, `pile`, `surf_z`) garantem que todas as
  camadas encaixem.

## Extras da Costela: sacola kraft, maçarico de mão e ícones (LAR-431)

Script: `build_extras.py` (importa funções de `build_bancada.py` sem executá-lo; não altera nem regenera os GLBs antigos).

```
blender.exe -b --factory-startup -P blender/bancada3d/build_extras.py -- [--renders DIR] [--only models,icons,renders] [--icons a,b] [--quick]
```

`--icons pasta` (por exemplo) gera só esses ícones e não refaz a folha `00-icones.png` (padrão: todos + folha).

Saídas: `public/assets/models/bancada/sacola.glb`, `public/assets/models/bancada/macarico-mao.glb`,
`public/assets/bancada/icones/{pao,pasta,costela,creme,mussarela,macarico,sacola}.webp` (512x512 com alfa) e, fora do repo,
`DIR/00-icones.png` (folha de contato), `01-sacola-fechada.png`, `02-sacola-aberta.png`, `03-macarico-mao.png`,
`04-macarico-chama.png`, `05-cena-com-sacola.png` (padrão de DIR: `\wsl.localhost\ubuntu\home\igor\orq\runs\lar-431-extras\renders`).

### sacola.glb

- Raiz `sacola` com dois filhos, `sacola_fechada` e `sacola_aberta`, sobrepostos na mesma origem (mostre um e esconda o outro).
  Item de mesa: centrado em x = 0, z = 0, apoiado em y = 0. Medidas: 0,18 m (x) x 0,11 m (z) x 0,262 m de altura;
  a **frente** (com a estampa) é o lado **+z** do glTF.
- `sacola_fechada`: topo achatado e dobrado duas vezes (vincos em y = 0,205 e 0,2335) com etiqueta branca sobre a dobra
  (meshes `sacola_fechada_frente`, `_corpo`, `_etiqueta`, `_etiqueta_tinta`). `sacola_aberta`: mesmo saco com a boca aberta, casca
  fina com face interna (`sacola_aberta_frente`, `sacola_aberta_corpo`).
- Estampa na frente: selo circular com o "A" de xilogravura, queijo, pão e alho, e **ALHOARIA** em caixa alta serifada,
  desenhados por script (numpy, sem fonte externa; refs `refs/ig-profile-shot.png` e `refs/logo-anota.jpg`) numa textura
  352x512 que cobre a frente inteira (x de -0,09 a 0,09, y de 0 a 0,262; UV planar). O resto usa uma textura de fibra de
  papel 256x256 (ladrilho de 0,06 m). Cores de vértice (`COLOR_0`) trazem o kraft e o sombreado dos vincos; materiais
  Principled simples, sem transparência.
- Os vincos (ondulação de ~1 mm, sulcos da dobra e prega lateral) são geometria; a estampa é textura.

### macarico-mao.glb

- Raiz `macarico_mao` (corpo em 5 meshes `maca_*`) + filho `chama` separado (mostrar/esconder). **Já está na posição de
  uso**: deitado, inclinado 35° para baixo, bico para -X e para baixo (cartucho laranja `#FF6A1A` com faixa preta, cabeça preta
  com gatilho e trava vermelha, bico de aço reto e fino com anel, queimador). Comprimento ~0,22 m.
- Origem no centro aproximado do maçarico (média dos vértices do corpo). Coordenadas locais em glTF (x, y, z):
  **ponta do bico** (fim do queimador) = **(-0,1010; -0,0703; 0,0000)**; direção do bico = (-0,8192; -0,5736; 0).
  A `chama` (cone com leve torção, azul no bico e laranja na ponta, materiais emissivos, ~0,078 m) começa 3,5 mm depois da
  ponta, na mesma direção. Para mirar a chama num ponto P, posicione o nó raiz em P - ponta (sem girar).
- Fica fora da `tabua`/lanche (não é item de mesa): o site o faz entrar voando só na hora de gratinar.

### Ícones da bandeja

WebP 512x512 com alfa, câmera 3/4 de cima, luz quente, item centrado ocupando ~80 % da maior dimensão do quadro
(enquadramento automático por alfa no script). `pao` (pão inteiro fechado, de `pao.glb`), `pasta` (pote de vidro baixo com
pasta de alho branca e cremosa, topo abaulado com salsinha, e 3 dentes de alho em leque na frente; LAR-433),
`costela` (`costela.glb` numa travessa oval), `creme` (pote com creme em espiral), `mussarela` (4 fatias em leque),
`macarico` (`macarico-mao.glb` com chama), `sacola` (sacola fechada). Recipientes, travessa, fatias e alho existem só para
o ícone e não são exportados. O vidro do pote é um material semitransparente (alfa 0,22, modo blended), só no ícone.

### Tamanho e triângulos

| arquivo | tamanho | triângulos |
|---|---:|---:|
| sacola.glb | 111.372 B (108,8 KB) | 10.554 |
| macarico-mao.glb | 25.800 B (25,2 KB) | 6.324 |

| ícone | tamanho |
|---|---:|
| pao.webp | 19.910 B |
| pasta.webp | 24.338 B (LAR-433; antes 14.890 B) |
| costela.webp | 30.674 B |
| creme.webp | 17.244 B |
| mussarela.webp | 17.036 B |
| macarico.webp | 11.560 B |
| sacola.webp | 29.258 B |

## Lanches do mini iFood: Pulled Pork!, Brócolis & Queijo! e Dogalho (LAR-431)

Script: `build_lanches.py` (importa funções de `build_bancada.py` sem rodar nada dele; não regenera nem altera os GLBs da
Costela). Mesmo contrato da seção anterior: GLB com Draco, Y para cima, metros, origem no centro do topo da tábua, nó raiz
com o nome do arquivo (hífen vira sublinhado), peças já na posição montada.

```
blender.exe -b --factory-startup -P blender/bancada3d/build_lanches.py -- [opções]
```

| opção | efeito |
|---|---|
| `--renders DIR` | pasta dos PNGs de revisão (padrão: `\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-431-lanches\renders`) |
| `--parts a,b` | constrói/exporta só essas peças (padrão: todas; `none` não exporta) |
| `--views 01,08` | renderiza só essas vistas (`01`..`16`, `r1`..`r9`; `none` não renderiza) |
| `--icons a,b` | gera só esses ícones (padrão: todos + folha `00-icones.png`; `none` não gera) |
| `--quick` | renders de 600 px e poucas amostras (iteração) |
| `--tag T` | sufixo dos renders de comparação `r1`..`r3` (padrão `depois`; use `--parts none --tag antes` com os GLBs antigos) |

Vistas do refino (LAR-433): `r1` = `01-pulled-pernil-<tag>` (recheio sobre a base, sem tampa), `r2` = `02-dog-brioche-<tag>`
(tampa a 64°), `r3` = `03-dog-salsichas-<tag>` (brioche fechado com as salsichas), `r5` = `pulled-montado-aberto`,
`r6` = `dogalho-aberto`, `r7` = `dogalho-montado`, `r8` = `pulled-tampa-fechada` (encaixe, tampa a 17°), `r9` =
`pulled-fechado-sem-queijo`.

Saídas: `public/assets/models/bancada/{pulled-pernil,brocolis-floretes,dog-*}.glb`, ícones WebP 512x512 com alfa em
`public/assets/bancada/icones/<id>.webp` e renders de revisão fora do repo.

### Pulled Pork! e Brócolis & Queijo! (pão de alho aberto)

Usam o `pao.glb` (base + tampa articulada, ângulo de fechar `+110°` em X, ver seção "Pão cortado ao meio") e as camadas
`pasta`, `creme`, `mussarela` e `gratinado` existentes. Só o recheio é novo e ocupa o mesmo volume e o mesmo encaixe da
`costela.glb` sob a tampa fechada.

- `pulled-pernil.glb` (raiz `pulled_pernil`, LAR-433): ~130 feixes de 2 a 4 fios grossos (3,6–5 mm, seção achatada de 4–5
  lados) que saem juntos, se curvam em arco ou S, se abrem numa ponta, passam por cima dos vizinhos e às vezes levantam a ponta;
  ~15 % dos feixes são lascas curtas e largas (8,5–12,5 mm). Tudo sobre um miolo irregular (calombos de carne e molho) no mesmo
  volume abaulado da costela (`pile`/`surf_z`); cada fio é limitado à cavidade da tampa (`zunder` + 0,9 mm) e o miolo nunca
  fica abaixo do topo da pasta. Cores: miolo rosado-dourado `#C98A5A`–`#E0B07A`, glaze avermelhado-caramelo `#8A3A1A`–`#C2652A`
  nas pontas e por cima (quanto depende do molho de cada feixe; ~28 % dos feixes quase sem molho), crostinhas `#5C2310`.
  Dois materiais com a mesma textura de fibras própria (256 px, cor + normal, estrias suaves): 0 = carne (roughness 0,60),
  1 = trechos com molho e topo do miolo (roughness 0,24, clearcoat 0,3); a face vai para o material 1 quando a cor de vértice
  é de molho (g/r < 0,585).
- `brocolis-floretes.glb` (raiz `brocolis_floretes`): 18 floretes (cabecinha com 1 lóbulo central, 3 laterais e brotinhos por
  cima; talo claro `#B9D68A`–`#DCEBB0` deitado, com a ponta de corte à mostra) + ~34 pedacinhos soltos, sobre um miolo verde
  escuro baixo. Cabecinhas `#4E8F3A`–`#7DBA5A` com textura granulada própria (256 px, cor + normal). Cada florete é
  limitado à cavidade da tampa (`zunder`); no pior caso o topo passa no máximo ~1 mm da cavidade da tampa (aperta, como a costela).
  Material 0 = cabecinhas (textura), material 1 = talos e miolo (só cor de vértice).

### Dogalho (brioche numa cestinha, não é pão de alho recheado)

Peças separadas, cada uma na posição montada e centrada na origem (tábua em y = 0). O pão de brioche fica sobre o papel da
cesta (fundo do pão em y = 6 mm). Do fundo para o topo:

`dog_cesta` -> `dog_brioche_base` -> `dog_pasta` -> `dog_salsichas` -> `dog_molhos` -> `dog_brioche_tampa` (fechada) ->
`dog_fondue` -> `dog_mussarela` -> `dog_palha`.

- `dog-cesta.glb` (raiz `dog_cesta`, filhos `dog_cesta_vime` e `dog_cesta_papel`): cestinha oval de vime (0,32 x 0,19 m no aro,
  0,046 m de altura, parede com trama sobre-e-sob em textura 512 px cor + normal, aro de corda e duas alças nas pontas) e papel
  manteiga xadrez claro que forra o fundo e a parede e dobra para fora do aro em alguns trechos (o resto do aro de corda
  fica à mostra). Material do vime: parede (textura) e aro/alças (cor de vértice); papel com textura xadrez 128 px.
- `dog-brioche.glb` (raiz `dog_brioche`, filhos `dog_brioche_base` e `dog_brioche_tampa`): pão de brioche comprido (0,224 x
  0,082 m, 0,072 m de altura), cortado na horizontal a 40 % da altura. A base é côncava para as salsichas; a tampa tem uma
  cavidade que cobre salsichas e molhos. LAR-433: casca brilhante (roughness 0,36, `KHR_materials_clearcoat` 0,22) com a cor
  na cor de vértice: dourado-escuro no topo (`#7E4413`–`#9C5719`, manchas leves de pincelado de ovo), faixa clara nas laterais
  (`#E3AE5E`–`#EEC57C`, onde os pães encostam na forma), fundo dourado; textura de casca própria só com mosqueado muito leve
  (256 px, ladrilho de 4 cm). Topo com leve irregularidade (0–2 mm, só para fora, para o fondue continuar assentando) e
  pontas arredondadas e mais baixas (a partir de |x| = 0,090 m a largura, a altura do topo e a base se arredondam; antes
  disso a seção é a mesma de `dprof`/`douter`). Miolo claro e fofo (textura própria 512 px, ladrilho de 4,5 cm, alvéolos
  pequenos e médios, UV pelo comprimento de arco para não esticar na cavidade) com um fio fino de casca na borda do corte.
  **Dobradiça igual à do pão de alho**: pivô do nó `dog_brioche_tampa` na aresta de trás, `translation = (0, 0.0348, -0.0407)`
  (y = topo do corte, z = -meia largura do corte), eixo X. A tampa é exportada **ABERTA** com `rotation.x = -110°`
  (-1,9199 rad, quaternion `(-0.8192, 0, 0, 0.5736)`). **Para FECHAR: levar a rotação X local de -1,9199 rad até 0**
  (girar +1,9199 rad = +110°). Fechada, ela assenta sobre as salsichas; `dog_fondue`, `dog_mussarela` e `dog_palha` já estão na
  posição de tampa **FECHADA** (só mostrar depois de fechar). Pasta, salsichas e molhos ficam sobre a base (visíveis aberta).
- `dog-pasta.glb`: camada de 3,4 mm sobre o miolo da base, com pontinhos de salsinha.
- `dog-salsichas.glb`: duas salsichas lado a lado (0,251 e 0,243 m, raio 13,6 mm), com leve arqueamento; as pontas passam
  ~1,4 cm do pão nas duas extremidades. LAR-433: cilindros longos que afunilam ~17 % nos últimos 3 cm e terminam numa ponta
  arredondada alongada (9,5 mm, não meia esfera) com um biquinho da tripa; cor de salsicha `#A5442A` (embaixo) –
  `#B8522F`–`#C8603A` (em cima), pontas mais escuras (`#7E3220`), rugas finas em hélice (torção) perto das pontas e marcas
  sutis de defumado; leve brilho (roughness 0,30, clearcoat 0,25). Até |x| ≈ 0,09 m o topo fica onde estava (os molhos
  continuam assentando); na ponta dos molhos (|x| = 0,104 m) a salsicha já está até 0,8 mm mais baixa.
- `dog-molhos.glb`: zigue-zague de ketchup e de mostarda sobre as salsichas (tubos de 4 mm, fases opostas).
- `dog-fondue.glb`: placa de 6 mm de fondue cremoso de 4 queijos sobre a tampa fechada, com línguas e fios escorrendo pelas
  laterais (material brilhante com clearcoat).
- `dog-mussarela.glb`: mussarela derretida por cima do fondue (menor, mais dourada, com manchas tostadas).
- `dog-palha.glb`: ~290 fios de batata palha (tubos de 3 lados, 1,3 mm) pousados sobre o fondue e a mussarela, em alturas
  diferentes.

### Ícones da bandeja

`public/assets/bancada/icones/<id>.webp` (512 x 512, fundo transparente, câmera 3/4 de cima, luz quente, item centrado e
ocupando ~80 % do quadro, ≤ 60 KB): `pulled-pernil` (montinho numa travessinha, com os mesmos feixes do GLB), `brocolis-floretes`, `dog-brioche`
(tampa entreaberta), `dog-pasta` (pote com 3 dentes de alho em leque, mesma função de dente do ícone `pasta`), `dog-salsichas`, `dog-molhos` (duas bisnagas), `dog-fondue`
(caquelon com queijo escorrendo), `dog-mussarela` (bloco e fatias) e `dog-palha` (montinho num prato de papel). Os
recipientes (travessa, pote, bisnagas, caquelon, prato) existem só para o ícone: não são exportados em GLB. O enquadramento
é medido na própria imagem (3 passadas ajustam distância e centro até a caixa do alfa ocupar ~80 %).

### Tamanho e triângulos (resultado do script)

| arquivo | tamanho | triângulos |
|---|---:|---:|
| pulled-pernil.glb | 253.816 B (247,9 KB) | 19.388 |
| brocolis-floretes.glb | 225.484 B (220,2 KB) | 19.236 |
| dog-cesta.glb | 108.828 B (106,3 KB) | 9.100 |
| dog-brioche.glb | 201.316 B (196,6 KB) | 17.280 |
| dog-pasta.glb | 21.036 B (20,5 KB) | 4.008 |
| dog-salsichas.glb | 28.412 B (27,7 KB) | 5.760 |
| dog-molhos.glb | 14.144 B (13,8 KB) | 3.624 |
| dog-fondue.glb | 35.884 B (35,0 KB) | 9.814 |
| dog-mussarela.glb | 34.848 B (34,0 KB) | 8.100 |
| dog-palha.glb | 39.108 B (38,2 KB) | 5.256 |

Orçamento: cada GLB ≤ 300 KB e ≤ 20 mil triângulos. Valores de `pulled-pernil`, `dog-brioche` e `dog-salsichas` após o
refino LAR-433 (antes: 182.896 B / 14.546, 140.084 B / 9.800 e 8.520 B / 1.280). Ícones refeitos no LAR-433:
`pulled-pernil.webp` 21.194 B, `dog-brioche.webp` 21.916 B, `dog-salsichas.webp` 12.732 B, `dog-pasta.webp` 15.692 B.

Renders de revisão (fora do repo): `NN-<lanche>-aberto.png`, `-montado.png` e `-explodido.png` para `pulled`, `brocolis` e
`dogalho` (`01`..`09`), detalhes `10`..`16` (recheios sem a tampa, topo do Dogalho, cesta, tampa entreaberta) e a folha
`00-icones.png`.


## Acompanhamentos da mesa: bebidas e porções (LAR-431)

Script: `build_acomp.py` (importa utilitários de `build_bancada.py` sem alterá-lo). Gera 5 itens de mesa, 5 ícones de bandeja e os renders de revisão:

```
blender.exe -b --factory-startup -P blender/bancada3d/build_acomp.py -- [--renders DIR] [--parts a,b|none] [--views 01..05,06,icons|none] [--quick]
```

Contrato: igual ao resto (GLB, Draco, Y para cima, metros, sem luzes/câmeras). Itens de mesa apoiados em y = 0, nó raiz com o nome do arquivo (hífen vira sublinhado). `beb-chopp`: o eixo do corpo fica na origem (a alça sai para +x); nos demais o centro do conjunto (prato + potinho) fica na origem. Na mesa, a tábua tem ~0,028 m de espessura (mesa em y = -0,028).

Vidro, líquidos, gelo e gotas usam `alphaMode BLEND` (sem transmission). A ordem dos nós no GLB é alfabética; o vidro vem por último. Se houver problema de ordenação no three.js, use `renderOrder`.

| arquivo | tamanho | triângulos | ícone |
|---|---:|---:|---:|
| beb-lata.glb | 45.156 B | 8.976 | beb-lata.webp. 13.320 B |
| beb-chopp.glb | 47.876 B | 14.970 | beb-chopp.webp. 18.488 B |
| beb-soda.glb | 51.512 B | 13.448 | beb-soda.webp. 17.114 B |
| porcao-dadinho.glb | 74.544 B | 12.888 | porcao-dadinho.webp. 14.422 B |
| porcao-batata.glb | 40.824 B | 7.032 | porcao-batata.webp. 18.118 B |

Renders de revisão (fora do repo): `/home/igor/orq/runs/lar-431-acomp/renders/` (`00-icones.png`, `01`..`05` itens, `06-mesa.png`). Ícones: 512x512 WebP com alfa, item ocupando ~80 % do quadro.

## Bancada gamificada: mão de luva, bisnaga, pote com colher e gratinado novo (LAR-449)

Script: `build_gamificado.py`. Ele importa utilitários de `build_bancada.py` sem executar nada desse arquivo e não altera
nenhum outro GLB.

```
blender.exe -b --factory-startup -P blender/bancada3d/build_gamificado.py -- [--parts mao,bisnaga,pote,gratinado|none] [--views maos,bisnaga,colher,macarico,gratinado|none] [--renders DIR] [--antigo GLB] [--quick]
```

Os renders de revisão ficam fora do repo, em `/home/igor/orq/runs/lar-449-modelos/renders/`. São eles `maos.png`,
`bisnaga-acao.png`, `colher-acao.png`, `macarico-acao.png`, `gratinado-antes.png` e `gratinado-depois.png`. O render
"antes" usa uma cópia do gratinado antigo (`--antigo`, padrão `<renders>/../gratinado-antigo.glb`).

O contrato é o mesmo das outras seções: GLB com Draco, Y para cima, metros, sem luzes e sem câmeras. As coordenadas
abaixo estão em **glTF** (x, y para cima, z para a frente). Quaternions no formato `(x, y, z, w)`.

### mao-luva.glb (raiz `mao_luva`)

Mão direita com luva preta de nitrilo (material acetinado: roughness 0,42 e clearcoat 0,18), com rugas leves no
punho e vincos na face palmar das juntas dobradas. O punho tem borda enrolada e fica vestido **por cima** de um
pedaço de manga de dólmã preto, que termina num corte limpo (boca oca, ~16 cm do pulso). A palma tem ~9 cm de
largura e a mão ~19 cm. A modelagem é por SDF: falanges em cones arredondados, palma, tenar e antebraço. A malha sai
de surface nets com decimação. Os dedos fecham sobre a ferramenta por contato.

Cinco filhos, um por pose: `mao_bisnaga`, `mao_colher`, `mao_macarico`, `mao_punhado` e `mao_aberta`. Cada filho é
uma malha só, com 2 materiais (luva e manga) e transformação identidade. **O pivô de todos é o pulso, na origem
`(0, 0, 0)` da raiz.** Mostre uma pose e esconda as outras. O antebraço sai do pulso para a direita e para cima,
vindo do lado da câmera. Para encaixar a ferramenta, use a transformação do objeto (`obj`) **no espaço local da raiz
`mao_luva`**. Pendure o nó da ferramenta na raiz da mão, ou aplique `mãoRaiz.matrixWorld × obj`.

| pose | objeto segurado | posição `obj` | rotação `obj` (x, y, z, w) | ponto útil | antebraço (pulso → cotovelo) |
|---|---|---|---|---|---|
| `mao_bisnaga` | `bisnaga.glb`, raiz `bisnaga` (de cabeça para baixo, rótulo para +z) | (-0,0848; 0,0932; 0,0293) | (0,0744; 0; 0,9972; 0) | ponta do bico (-0,0848; -0,0968; 0,0293) | (0,95; 0,26; 0,17) |
| `mao_colher` | `pote-creme.glb`, nó `colher` (empunhada, concha à esquerda, lado côncavo para cima) | (-0,0454; -0,0308; -0,0511) | (0,0797; 0,3176; 0,2300; 0,9164) | centro da concha (-0,1209; -0,0939; 0,0084) | (0,81; 0,42; 0,41) |
| `mao_macarico` | `macarico-mao.glb`, raiz `macarico_mao` (**sem girar**, mesma pose de uso) | (-0,0031; -0,0724; -0,0570) | (0; 0; 0; 1) | ponta do bico (-0,1041; -0,1427; -0,0570) | (0,51; 0,45; 0,73) |
| `mao_punhado` | nenhum: ponto de soltura do punhado | (-0,0637; -0,0659; 0,0021) | — | — | (0,86; 0,48; 0,15) |
| `mao_aberta` | nenhum: centro da palma | (-0,0597; -0,0473; -0,0016) | — | — | (0,86; 0,48; 0,15) |

Para mirar uma ponta (bico ou concha) num ponto P, ponha a raiz da mão em `P - ponta`, sem girar. No maçarico, a chama
continua com a mesma direção da seção "macarico-mao.glb": (-0,8192; -0,5736; 0).

### bisnaga.glb (raiz `bisnaga`)

Bisnaga estilo diner: corpo branco-creme (`bisnaga_corpo`), faixa laranja com **ALHOARIA** em letras creme e
filetes (`bisnaga_marca`), tampa rosqueada e bico cônico laranja (`bisnaga_tampa`). Ela fica em pé, com a base em
y = 0 e o eixo em x = z = 0. Mede 0,19 m de altura, com raio de 0,029 m. O rótulo fica de frente para **+z**. **Ponta
do bico: (0; 0,19; 0)**.

### pote-creme.glb (raiz `pote_creme`)

- `pote`: tigela de cerâmica branca esmaltada (pé sem esmalte), Ø 0,115 m e borda em y ≈ 0,064, com creme claro
  dentro (topo em y ≈ 0,055, redemoinho leve). A origem fica no centro da base.
- `colher`: colher de inox (0,175 m) com uma porção de creme na concha. Ela vem apoiada no pote: concha mergulhada
  no creme e cabo encostado na borda (nó com `translation (0,0859; 0,0701; 0,0224)` e `rotation (-0,0140; -0,1211;
  0,1140; 0,9860)`). **O pivô do nó é o ponto de pega do cabo.** No quadro local da colher, o cabo corre ao longo de
  +x e a concha fica em -x, com o lado côncavo para +y. **Centro da concha (local): (-0,1145; -0,0103; 0)**. Ponta
  do cabo (local): (0,0330; -0,0023; 0).

### gratinado.glb (refeito)

O nó continua `gratinado`, com o filho `gratinado_queijo`. A posição e o encaixe também continuam os mesmos: decalque
sobre o topo da `mussarela`, de 0,9 mm acima dela no meio a 0,5 mm nas beiradas, com |x| ≤ 0,123 m. A varredura
por plano de corte do site funciona igual. É uma folha única com textura de cor e normal map embutidos (JPEG
512 × 256, UV planar x/largura). O queijo é dourado-âmbar contínuo, com bolhas de 1 a 4 mm, cristas tostadas e
laterais um pouco mais tostadas, e se funde com a mussarela nas beiradas. A cor mais escura da textura é `#A15724`
(âmbar-tostado). Não há manchas pretas.

### Tamanho e triângulos

| arquivo | tamanho | triângulos |
|---|---:|---:|
| mao-luva.glb | 91.996 B (89,8 KB) | 29.249 (5 poses × ~5.850) |
| bisnaga.glb | 15.676 B (15,3 KB) | 5.062 |
| pote-creme.glb | 31.964 B (31,2 KB) | 10.970 |
| gratinado.glb | 67.632 B (66,0 KB) | 8.990 (antes: 35.636 B / 11.610) |

## Fundo da bancada gamificada: cozinha escura (LAR-449, protótipo)

Script: `build_cozinha_fundo.py`. Ele não importa nem altera nenhum GLB: modela só o cenário (tampo escuro, parede de
azulejo preto, prateleira com fita de luz quente, potes e réstias de alho) e renderiza no Cycles com desfoque leve de
profundidade de campo, sem a tábua e sem as estações (o three.js desenha tudo isso por cima).

```
blender.exe -b --factory-startup -P blender/bancada3d/build_cozinha_fundo.py -- [--only retrato,paisagem] [--quick] [--q 74] [--out DIR]
```

Saídas: `public/assets/bancada/proto/cozinha-retrato.webp` (900 × 1600) e `cozinha-paisagem.webp` (1600 × 900), cada
uma ≤ 180 KB. As câmeras são as mesmas de `src/components/bancada-proto/layout.ts` (`CAMERAS`), convertidas de three
(x, y para cima, z para a câmera) para Blender (x, -z, y), com fov vertical e o tampo em y = -0,028 (three). Assim o
tampo do fundo coincide com a mesa do 3D; o site corrige o fov quando a tela recorta a imagem pela largura
(`fovPara`). Se mudar uma câmera, mude a outra. A prateleira é erguida em cada vista até ficar logo abaixo do topo do
quadro, para a fita de luz e as réstias aparecerem nas duas.
