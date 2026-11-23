import assert from "node:assert/strict";
import test from "node:test";
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { assentarPeca, clonarModeloDaBancada, clonarNosDaBancada, criarPoteComTampa, curvaCubica, fiapos, punhadoNaMao } from "../dist/esm/index.js";

test("a mesma porção atende receitas com outras cores e acabamentos", () => {
  const creme = criarPoteComTampa("#e2862c");
  const molho = criarPoteComTampa("#f1d88e", { opacidadeTampa: 0.16, sombrasDoCopo: false });
  assert.equal(creme.children.length, 4);
  assert.equal(molho.children.length, 4);
  const [copo, recheio, tampa] = creme.children;
  assert.equal(recheio.material.color.getHexString(), "e2862c");
  assert.equal(molho.children[1].material.color.getHexString(), "f1d88e");
  assert.equal(tampa.material.opacity, 0.38);
  assert.equal(molho.children[2].material.opacity, 0.16);
  assert.equal(copo.castShadow, true);
  assert.equal(molho.children[0].castShadow, false);
  assert.notEqual(recheio.material, molho.children[1].material);
  assert.deepEqual(new Box3().setFromObject(creme), new Box3().setFromObject(molho));
});

test("clones do GLB compartilham a malha e isolam materiais só quando precisam", () => {
  const fonte = new Group();
  const peca = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: "#fff" }));
  peca.name = "recheio";
  fonte.add(peca);
  const porcao = new Group();
  clonarNosDaBancada(fonte, ["recheio", "ausente"], porcao);
  assert.equal(porcao.children.length, 1);
  assert.notEqual(porcao.children[0], peca);
  assert.equal(porcao.children[0].geometry, peca.geometry);
  assert.equal(porcao.children[0].material, peca.material);
  const isolada = clonarModeloDaBancada(peca, { materiaisIndependentes: true, sombras: true });
  isolada.material.color.set("#f00");
  assert.equal(peca.material.color.getHexString(), "ffffff");
  assert.equal(isolada.geometry, peca.geometry);
  assert.equal(isolada.receiveShadow, true);
});

test("ingrediente procedural é determinístico e usa uma geometria com cores por vértice", () => {
  const montar = (seed) => fiapos(8, 0.02, ["#e2862c"], 0.014, 0.003, seed);
  const a = montar(5), b = montar(5), c = montar(6);
  const vertices = (g) => g.getAttribute("position");
  assert.equal(a.getAttribute("color").count, vertices(a).count);
  assert.deepEqual(vertices(a).array, vertices(b).array);
  assert.notDeepEqual(vertices(a).array, vertices(c).array);
  assert.deepEqual(
    vertices(punhadoNaMao("queijo-dobro", 12).geometry).array,
    vertices(punhadoNaMao("queijo-dobro", 12).geometry).array,
  );
});

test("a curva aceita o próprio ponto de entrada como saída e mantém o contato no assentamento", () => {
  const a = new Vector3(0, 0, 0), b = new Vector3(0, 1, 0);
  const c = new Vector3(1, 1, 0), d = new Vector3(1, 0, 0);
  assert.equal(curvaCubica(a, a, b, c, d, 0.5), a);
  assert.deepEqual(a.toArray(), [0.5, 0.75, 0]);
  assert.deepEqual(curvaCubica(c, a, b, c, d, 1).toArray(), d.toArray());

  const base = 0.03;
  const [y, , escalaY] = assentarPeca(0.42, false, base);
  assert.ok(Math.abs(y - base * escalaY + base) < 1e-12);
  assert.deepEqual(assentarPeca(0.5, true, base), [0, 0.5, 0.5]);
});
