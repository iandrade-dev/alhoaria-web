# Bancada 3D

`@cardapios/bancada-3d` é a biblioteca de ingredientes, movimentos, câmera e realidade aumentada.
O front importa as funções pelo nome e fornece as medidas, os modelos autorizados e os dados da receita.
A biblioteca usa a mesma instância de Three.js que o site.

| Para reutilizar | Funções |
| --- | --- |
| Potinho com molho | `criarPoteComTampa` recebe a cor do molho e opções de acabamento. |
| Ingredientes leves | `fiapos` gera ralados ou desfiados com uma geometria. `floretes` gera brócolis. `tigela` gera o recipiente. |
| Porções e adicionais | `dose`, `potinho` e `punhadoNaMao` montam a mesma porção na bancada, na mão e sobre a receita. |
| Peças de um GLB | `clonarModeloDaBancada` instancia um modelo. `clonarNosDaBancada` extrai os nós nomeados para o grupo da porção. |
| Movimentos | `curvaCubica` calcula a posição no vetor de saída. `assentarPeca` calcula o deslocamento e a escala ao pousar. |
| Animações de montagem | `ACOES` e `ACOES_DOG` têm tempos e trajetórias para espalhar, pegar porções, fechar o pão e gratinar. |
| Comida recém-feita | `suculento`, `brasa` e `vaporQuente` aplicam acabamento e efeitos ao modelo. |

Por exemplo, duas receitas podem usar a mesma porção com cores diferentes e dirigir o movimento
com os pontos de contato de cada tábua.

```ts
import { criarPoteComTampa, curvaCubica } from "@cardapios/bancada-3d";
import { Vector3 } from "three";

const porcao = criarPoteComTampa("#e2862c");
const origem = new Vector3(0.15, 0, 0);
const subida = new Vector3(0.15, 0.08, 0);
const descida = new Vector3(0, 0.08, 0);
const destino = new Vector3(0, 0.03, 0);
curvaCubica(porcao.position, origem, subida, descida, destino, 0.5);
```

Os clones GLB compartilham geometria e texturas. Ative `materiaisIndependentes` quando a instância
precisar aplicar cor ou recorte. Os geradores procedurais entregam recursos próprios para descarte
ao desmontar a cena. Uma receita nova pode combinar os mesmos geradores e movimentos com outros
modelos, medidas e tempos.

O Alhoaria usa o workspace local. O Strawberry instala a versão empacotada de uma release do
Alhoaria no GitHub, com integridade registrada no `package-lock.json`.

Para versionar, atualize o pacote e a dependência do Alhoaria e rode `npm install`.
Rode `npm test --workspace @cardapios/bancada-3d` e gere o arquivo com
`npm pack --workspace @cardapios/bancada-3d`. Valide o `.tgz` no Strawberry antes de anexá-lo
à release `bancada-3d-v<versão>` do commit. Atualize a dependência do Strawberry para a URL
da nova release e registre o lockfile.
