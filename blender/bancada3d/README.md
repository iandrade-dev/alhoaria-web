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
