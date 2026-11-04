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
| `--renders DIR` | pasta dos PNGs de revisão (fora do repo). Padrão: `\\wsl.localhost\ubuntu\home\igor\orq\runs\lar-429-modelos\renders` |
| `--parts a,b` | constrói/exporta só essas peças (padrão: todas) |
| `--views 10,04` | renderiza só essas vistas (`01`..`12`, `poster`; `none` não renderiza) |
| `--quick` | renders de 600 px, poucas amostras (iteração) |
| `--no-poster` | não gera o poster |

Saídas:

- `public/assets/models/bancada/*.glb` (8 arquivos)
- `public/assets/bancada/lanche-pronto.webp` (poster, 1600 px, mesmo enquadramento do render 10)
- `DIR/01-tabua.png` ... `08-macarico.png`, `09-macarico-chama.png` (extra), `10-montado.png`,
  `11-explodido.png`, `12-close-costela.png`, `13-aberto-recheado.png` (EEVEE, 1200 px). Os renders são feitos reimportando os GLBs
  exportados, ou seja, mostram o que o site recebe.

## Contrato técnico

- glTF binário (`.glb`), Y para cima, 1 unidade = 1 m, transformações aplicadas, compressão Draco ligada
  (`KHR_draco_mesh_compression`). Sem luzes e sem câmeras.
- Espaço comum: todas as camadas já estão na posição montada. Origem do mundo = centro do topo da tábua
  (topo em y = 0). Carregar todos os GLBs na origem mostra o lanche montado na tábua. O pão tem 0,30 m no
  eixo X, centrado em x = 0, z = 0 (largura ~0,10 m, altura ~0,07 m fechado). A tábua vai de x = -0,21 a 0,33 (com cabo)
  e z = -0,15 a 0,15 (z do glTF = -y do Blender).
- Cada arquivo tem um nó raiz com o nome da peça: `tabua`, `pao`, `pasta`, `costela`, `creme`, `mussarela`,
  `gratinado`, `macarico`.
- `macarico.glb`: o nó `macarico` contém os meshes do corpo e o objeto `chama` (cone azul na base e laranja na
  ponta, materiais emissivos), separado para o site mostrar/esconder. O maçarico fica deitado na tábua, em
  z(glTF) ≈ +0,108, ao lado do pão, com o bico apontando para -x.
- Cores: cores de vértice (`COLOR_0`, atributo `Col`) multiplicadas por um material Principled simples
  (pão, pasta, costela, creme, mussarela, gratinado). A tábua usa uma textura JPEG 512x512 embutida
  (madeira, veio sugerido). O maçarico usa materiais de cor sólida. Ligue `vertexColors` no material do
  three.js (o GLTFLoader já faz isso quando há `COLOR_0`).
- Mussarela e creme têm material com brilho (roughness baixa; a mussarela usa `KHR_materials_clearcoat`).

## Pão cortado ao meio (base + tampa articulada)

O pão é cortado na horizontal (plano y = 0,037 m, no glTF) e chega meio aberto, como no vídeo do hero.
`pao.glb` tem o nó raiz `pao` com dois filhos:

- `pao_base`: metade de baixo, miolo para cima (levemente côncavo), na posição final.
- `pao_tampa`: metade de cima, casca dourada. O pivô do nó fica na linha da dobradiça: a aresta longa de trás
  (z negativo) no topo da base, em `translation = (0, 0.037, -0.052)`, eixo de rotação = X. A tampa é exportada
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
| tabua.glb | 54.072 B (52.8 KB) | 2.852 |
| pao.glb | 68.416 B (66.8 KB) | 15.792 |
| pasta.glb | 24.984 B (24.4 KB) | 4.434 |
| costela.glb | 179.080 B (174.9 KB) | 28.428 |
| creme.glb | 35.024 B (34.2 KB) | 11.232 |
| mussarela.glb | 59.356 B (58.0 KB) | 14.676 |
| gratinado.glb | 35.680 B (34.8 KB) | 11.610 |
| macarico.glb | 18.480 B (18.0 KB) | 4.392 |
| **soma** | **475.092 B (464 KB)** | **93.416** |

Orçamento: cada GLB <= 300 KB, soma <= 1,2 MB, peça <= 20 mil triângulos (costela <= 30 mil).
Poster: `lanche-pronto.webp`, 68 KB (<= 200 KB).

## Notas de modelagem

- Pão: loft de 84 secções (superelipse que afina nas pontas) cortado em duas metades, base e tampa, com miolo
  claro e borda tostada; marcas de corte e tostado por cor de vértice.
- Costela: ~430 fios (tubos de 4 lados achatados, com raio variável e caminhos meandrantes que seguem a
  superfície do monte e escorrem pelas bordas do pão) sobre um miolo escuro; ~15 % são tiras largas.
- Creme e mussarela: placas grossas parametrizadas, de borda irregular com línguas que escorrem; a mussarela
  tem gotas (tubos) pela lateral do pão.
- Gratinado: manchas de formas variadas em aglomerados, do âmbar na borda ao quase queimado no centro.
- Funções analíticas compartilhadas (`bprof`, `zouter`, `zfloor`, `pile`) garantem que todas as camadas encaixem.
