import { BufferGeometry, Material, Mesh, Object3D, Texture } from "three";

function inventario(raizes: Object3D[]) {
  const geometrias = new Set<BufferGeometry>(), materiais = new Set<Material>(), texturas = new Set<Texture>();
  raizes.forEach((raiz) => raiz.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    geometrias.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: Material) => {
      materiais.add(m);
      Object.values(m).forEach((v) => { if (v instanceof Texture) texturas.add(v); });
    });
  }));
  return { geometrias, materiais, texturas };
}

/** Libera só os recursos da montagem; o cache GLTF compartilhado continua íntegro. */
export function liberarMontagem(raizes: Object3D[], fontes: Object3D[]) {
  const proprios = inventario(raizes), compartilhados = inventario(fontes);
  proprios.geometrias.forEach((r) => { if (!compartilhados.geometrias.has(r)) r.dispose(); });
  proprios.materiais.forEach((r) => { if (!compartilhados.materiais.has(r)) r.dispose(); });
  proprios.texturas.forEach((r) => { if (!compartilhados.texturas.has(r)) r.dispose(); });
}
