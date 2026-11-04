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
  `11-explodido.png`, `12-close-costela.png` (EEVEE, 1200 px). Os renders são feitos reimportando os GLBs
  exportados, ou seja, mostram o que o site recebe.

## Contrato técnico

- glTF binário (`.glb`), Y para cima, 1 unidade = 1 m, transformações aplicadas, compressão Draco ligada
  (`KHR_draco_mesh_compression`). Sem luzes e sem câmeras.
- Espaço comum: todas as camadas já estão na posição montada. Origem do mundo = centro do topo da tábua
  (topo em y = 0). Carregar todos os GLBs na origem mostra o lanche montado na tábua. O pão tem 0,30 m no
  eixo X, centrado em x = 0, z = 0 (largura ~0,10 m, altura ~0,07 m). A tábua vai de x = -0,21 a 0,33 (com cabo)
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

## Camadas (ordem vertical, de baixo para cima)

`tabua` -> `pao` -> `pasta` -> `costela` -> `creme` -> `mussarela` -> `gratinado`. O `gratinado` é um decalque
fino apoiado ~0,9 mm acima da mussarela (não tem z-fighting a distâncias normais; se a câmera ficar muito longe,
aumente o `near` ou use `polygonOffset` no material).

## Tamanho e triângulos (resultado do script)

| arquivo | tamanho | triângulos |
|---|---:|---:|
| tabua.glb | 54.072 B (52,8 KB) | 2.852 |
| pao.glb | 49.500 B (48,3 KB) | 11.360 |
| pasta.glb | 23.960 B (23,4 KB) | 4.434 |
| costela.glb | 180.296 B (176,1 KB) | 28.428 |
| creme.glb | 37.820 B (36,9 KB) | 11.232 |
| mussarela.glb | 58.444 B (57,1 KB) | 14.680 |
| gratinado.glb | 35.468 B (34,6 KB) | 11.610 |
| macarico.glb | 18.480 B (18,0 KB) | 4.392 |
| **soma** | **458.040 B (447 KB)** | **88.988** |

Orçamento: cada GLB <= 300 KB, soma <= 1,2 MB, peça <= 20 mil triângulos (costela <= 30 mil).
Poster: `lanche-pronto.webp`, 72 KB (<= 200 KB).

## Notas de modelagem

- Pão: casco em loft de 100 secções (superelipse que afina nas pontas), abertura de barquinho com lábio
  tostado e miolo claro visível; marcas de corte e tostado por cor de vértice.
- Costela: ~430 fios (tubos de 4 lados achatados, com raio variável e caminhos meandrantes que seguem a
  superfície do monte e escorrem pelas bordas do pão) sobre um miolo escuro; ~15 % são tiras largas.
- Creme e mussarela: placas grossas parametrizadas, de borda irregular com línguas que escorrem; a mussarela
  tem gotas (tubos) pela lateral do pão.
- Gratinado: manchas de formas variadas em aglomerados, do âmbar na borda ao quase queimado no centro.
- Funções analíticas compartilhadas (`bprof`, `zouter`, `zfloor`, `pile`) garantem que todas as camadas encaixem.
