import { Mesh, type Group, type Object3D } from "three";

type OpcoesModelo = {
  materiaisIndependentes?: boolean;
  sombras?: boolean;
};

/** Cada instância tem suas próprias transformações. Geometria e texturas vêm do cache do modelo. */
export function clonarModeloDaBancada<T extends Object3D>(origem: T, opcoes: OpcoesModelo = {}): T {
  const copia = origem.clone(true);
  const { materiaisIndependentes, sombras } = opcoes;
  if (!materiaisIndependentes && sombras === undefined) return copia;
  copia.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (materiaisIndependentes) {
      node.material = Array.isArray(node.material)
        ? node.material.map((material) => material.clone())
        : node.material.clone();
    }
    if (sombras !== undefined) node.castShadow = node.receiveShadow = sombras;
  });
  return copia;
}

/** Separa peças pelo nome original no GLB e mantém os recursos compartilhados. */
export function clonarNosDaBancada(origem: Object3D | undefined, nomes: readonly string[], grupo: Group): void {
  for (const nome of nomes) {
    const peca = origem?.getObjectByName(nome);
    if (peca) grupo.add(clonarModeloDaBancada(peca));
  }
}
