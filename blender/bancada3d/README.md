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
blender.exe -b --factory-startup -P blender/bancada3d/build_extras.py -- [--renders DIR] [--only models,icons,renders] [--quick]
```

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
(enquadramento automático por alfa no script). `pao` (pão inteiro fechado, de `pao.glb`), `pasta` (bisnaga + montinho + alho),
`costela` (`costela.glb` numa travessa oval), `creme` (pote com creme em espiral), `mussarela` (4 fatias em leque),
`macarico` (`macarico-mao.glb` com chama), `sacola` (sacola fechada). Recipientes, travessa, fatias e alho existem só para
o ícone e não são exportados.

### Tamanho e triângulos

| arquivo | tamanho | triângulos |
|---|---:|---:|
| sacola.glb | 111.372 B (108,8 KB) | 10.554 |
| macarico-mao.glb | 25.800 B (25,2 KB) | 6.324 |

| ícone | tamanho |
|---|---:|
| pao.webp | 19.910 B |
| pasta.webp | 14.890 B |
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
| `--views 01,08` | renderiza só essas vistas (`01`..`16`; `none` não renderiza) |
| `--icons a,b` | gera só esses ícones (padrão: todos + folha `00-icones.png`; `none` não gera) |
| `--quick` | renders de 600 px e poucas amostras (iteração) |

Saídas: `public/assets/models/bancada/{pulled-pernil,brocolis-floretes,dog-*}.glb`, ícones WebP 512x512 com alfa em
`public/assets/bancada/icones/<id>.webp` e renders de revisão fora do repo.

### Pulled Pork! e Brócolis & Queijo! (pão de alho aberto)

Usam o `pao.glb` (base + tampa articulada, ângulo de fechar `+110°` em X, ver seção "Pão cortado ao meio") e as camadas
`pasta`, `creme`, `mussarela` e `gratinado` existentes. Só o recheio é novo e ocupa o mesmo volume e o mesmo encaixe da
`costela.glb` sob a tampa fechada.

- `pulled-pernil.glb` (raiz `pulled_pernil`): ~390 fios em ~100 feixes (tubos de 3 lados, 4 trechos, cada fio com curvatura e
  ondulação próprias) mais pedaços curtos e grossos no meio, sobre um miolo marrom claro irregular (nunca aparece base lisa).
  Cores `#B4774A`–`#D9A066` com variações acinzentadas, pontas caramelizadas (`#7A3A18`/`#A5481F`), textura de fibras (a mesma
  da costela, 256 px, cor + normal) multiplicada pela cor de vértice. Mais claro e dourado que a costela.
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
  0,082 m, 0,072 m de altura), cortado na horizontal a 40 % da altura. Casca dourada brilhante (cor de vértice,
  `KHR_materials_clearcoat`), miolo com a textura de alvéolos do pão (512 px, ladrilho de 5 cm: furinhos finos). A base é
  côncava para as salsichas; a tampa tem uma cavidade que cobre salsichas e molhos.
  **Dobradiça igual à do pão de alho**: pivô do nó `dog_brioche_tampa` na aresta de trás, `translation = (0, 0.0348, -0.0407)`
  (y = topo do corte, z = -meia largura do corte), eixo X. A tampa é exportada **ABERTA** com `rotation.x = -110°`
  (-1,9199 rad, quaternion `(-0.8192, 0, 0, 0.5736)`). **Para FECHAR: levar a rotação X local de -1,9199 rad até 0**
  (girar +1,9199 rad = +110°). Fechada, ela assenta sobre as salsichas; `dog_fondue`, `dog_mussarela` e `dog_palha` já estão na
  posição de tampa **FECHADA** (só mostrar depois de fechar). Pasta, salsichas e molhos ficam sobre a base (visíveis aberta).
- `dog-pasta.glb`: camada de 3,4 mm sobre o miolo da base, com pontinhos de salsinha.
- `dog-salsichas.glb`: duas salsichas lado a lado (0,251 e 0,243 m, raio 13,6 mm), vermelhas e brilhantes, com leve
  arqueamento; as pontas passam ~1,4 cm do pão nas duas extremidades.
- `dog-molhos.glb`: zigue-zague de ketchup e de mostarda sobre as salsichas (tubos de 4 mm, fases opostas).
- `dog-fondue.glb`: placa de 6 mm de fondue cremoso de 4 queijos sobre a tampa fechada, com línguas e fios escorrendo pelas
  laterais (material brilhante com clearcoat).
- `dog-mussarela.glb`: mussarela derretida por cima do fondue (menor, mais dourada, com manchas tostadas).
- `dog-palha.glb`: ~290 fios de batata palha (tubos de 3 lados, 1,3 mm) pousados sobre o fondue e a mussarela, em alturas
  diferentes.

### Ícones da bandeja

`public/assets/bancada/icones/<id>.webp` (512 x 512, fundo transparente, câmera 3/4 de cima, luz quente, item centrado e
ocupando ~80 % do quadro, ≤ 60 KB): `pulled-pernil` (montinho numa travessinha), `brocolis-floretes`, `dog-brioche`
(tampa entreaberta), `dog-pasta` (pote com dentes de alho), `dog-salsichas`, `dog-molhos` (duas bisnagas), `dog-fondue`
(caquelon com queijo escorrendo), `dog-mussarela` (bloco e fatias) e `dog-palha` (montinho num prato de papel). Os
recipientes (travessa, pote, bisnagas, caquelon, prato) existem só para o ícone: não são exportados em GLB. O enquadramento
é medido na própria imagem (3 passadas ajustam distância e centro até a caixa do alfa ocupar ~80 %).

### Tamanho e triângulos (resultado do script)

| arquivo | tamanho | triângulos |
|---|---:|---:|
| pulled-pernil.glb | 182.896 B (178,6 KB) | 14.546 |
| brocolis-floretes.glb | 225.484 B (220,2 KB) | 19.236 |
| dog-cesta.glb | 108.828 B (106,3 KB) | 9.100 |
| dog-brioche.glb | 140.084 B (136,8 KB) | 9.800 |
| dog-pasta.glb | 21.036 B (20,5 KB) | 4.008 |
| dog-salsichas.glb | 8.520 B (8,3 KB) | 1.280 |
| dog-molhos.glb | 14.144 B (13,8 KB) | 3.624 |
| dog-fondue.glb | 35.884 B (35,0 KB) | 9.814 |
| dog-mussarela.glb | 34.848 B (34,0 KB) | 8.100 |
| dog-palha.glb | 39.108 B (38,2 KB) | 5.256 |

Orçamento: cada GLB ≤ 300 KB e ≤ 20 mil triângulos.

Renders de revisão (fora do repo): `NN-<lanche>-aberto.png`, `-montado.png` e `-explodido.png` para `pulled`, `brocolis` e
`dogalho` (`01`..`09`), detalhes `10`..`16` (recheios sem a tampa, topo do Dogalho, cesta, tampa entreaberta) e a folha
`00-icones.png`.
