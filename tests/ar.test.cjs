const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Group, Mesh, Matrix4, Vector3, Quaternion } = require('three');
const { SessaoMesa } = require('../.ar-tests/components/ar/sessao.js');
const { sequencia, estacao } = require('../.ar-tests/components/ar/sequencia.js');
const { pedidoDaURL, urlDoPedido } = require('../.ar-tests/lib/pedido-url.js');
const { LANCHES } = require('../.ar-tests/components/bancada-proto/layout.js');
const { liberarMontagem } = require('../.ar-tests/components/ar/recursos.js');

function ambiente(pedido) {
  const eventos = new EventTarget();
  const referencia = new EventTarget();
  let cancelamentos = 0;
  const hit = { cancel: () => cancelamentos++ };
  const sessao = Object.assign(eventos, {
    visibilityState: 'visible',
    requestReferenceSpace: async () => referencia,
    requestHitTestSource: async () => hit,
    end: async () => eventos.dispatchEvent(new Event('end')),
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { xr: { requestSession: (...args) => pedido ? pedido(...args) : Promise.resolve(sessao) } } });
  const camera = new Group(); camera.position.set(0, 1, 1); camera.updateMatrixWorld();
  const renderer = { xr: { setReferenceSpaceType() {}, setFoveation() {}, setSession: async () => {}, getReferenceSpace: () => referencia, getCamera: () => camera } };
  const origem = new Group(), reticulo = new Mesh(), estados = [];
  let tempo = 0;
  const controle = new SessaoMesa(renderer, {}, origem, reticulo, (e) => estados.push(e), () => tempo);
  const quadro = (matriz, rastreando = true) => ({
    getViewerPose: () => rastreando ? { transform: { matrix: camera.matrixWorld.elements } } : null,
    getHitTestResults: () => (Array.isArray(matriz) ? matriz : matriz ? [matriz] : []).map((m) => ({ getPose: () => m ? { transform: { matrix: m.elements } } : null })),
  });
  return { controle, sessao, origem, reticulo, estados, referencia, quadro, camera, avancarTempo: (ms) => { tempo += ms; }, cancelamentos: () => cancelamentos };
}

test('só coloca em superfície horizontal e permanece no lugar depois de colocado', async () => {
  const a = ambiente(); await a.controle.iniciar();
  assert.equal(a.controle.colocar(), false);
  const parede = new Matrix4().makeRotationX(Math.PI / 2);
  a.controle.atualizar(a.quadro(parede));
  assert.equal(a.estados.at(-1).fase, 'buscando');
  const mesa = new Matrix4().makeTranslation(0.4, 0.7, -1);
  a.controle.atualizar(a.quadro(mesa));
  assert.equal(a.estados.at(-1).fase, 'superficie');
  assert.equal(a.controle.colocar(), true);
  assert.deepEqual(a.origem.position.toArray(), [0.4, 0.7, -1]);
  a.controle.atualizar(a.quadro(new Matrix4().makeTranslation(9, 9, 9)));
  assert.deepEqual(a.origem.position.toArray(), [0.4, 0.7, -1]);
  a.controle.atualizar(a.quadro(null, false));
  assert.equal(a.origem.visible, false);
  assert.equal(a.estados.at(-1).rastreando, false);
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.origem.visible, true);
  await a.controle.sair();
  assert.equal(a.cancelamentos(), 1);
  assert.equal(a.estados.at(-1).fase, '3d');
  assert.deepEqual(a.origem.position.toArray(), [0, 0, 0]);
});

test('reposicionar e reset descartam o resultado anterior antes de permitir um novo toque', async () => {
  const a = ambiente(); await a.controle.iniciar();
  a.controle.atualizar(a.quadro(new Matrix4())); a.controle.colocar();
  a.referencia.dispatchEvent(new Event('reset'));
  assert.equal(a.controle.colocar(), false);
  assert.equal(a.origem.visible, false);
  a.controle.atualizar(a.quadro(new Matrix4()));
  assert.equal(a.controle.colocar(), true);
  a.sessao.visibilityState = 'hidden'; a.sessao.dispatchEvent(new Event('visibilitychange'));
  assert.equal(a.reticulo.visible, false);
  assert.equal(a.estados.at(-1).rastreando, false);
  await a.controle.sair();
});

test('encontra a mesa mesmo quando o primeiro resultado é uma parede ou não tem pose', async () => {
  const a = ambiente(); await a.controle.iniciar();
  const parede = new Matrix4().makeRotationX(Math.PI / 2);
  const mesa = new Matrix4().makeTranslation(0.2, 0.7, -0.5);
  a.controle.atualizar(a.quadro([null, parede, mesa]));
  assert.equal(a.estados.at(-1).fase, 'superficie');
  assert.equal(a.controle.colocar(), true);
  assert.deepEqual(a.origem.position.toArray(), [0.2, 0.7, -0.5]);
  await a.controle.sair();
});

test('aceita inclinação moderada sem aceitar parede ou teto', async () => {
  const a = ambiente(); await a.controle.iniciar();
  const parede = new Matrix4().makeRotationX(Math.PI / 2);
  const teto = new Matrix4().makeRotationX(Math.PI);
  a.controle.atualizar(a.quadro([parede, teto]));
  assert.equal(a.controle.colocar(), false);
  a.controle.atualizar(a.quadro(new Matrix4().makeRotationX(Math.PI / 10)));
  assert.equal(a.controle.colocar(), true);
  await a.controle.sair();
});

test('pequena falha de hit-test não faz o botão sumir; resultado antigo expira', async () => {
  const a = ambiente(); await a.controle.iniciar();
  a.controle.atualizar(a.quadro(new Matrix4()));
  a.avancarTempo(150); a.controle.atualizar(a.quadro(null));
  assert.equal(a.reticulo.visible, true);
  assert.equal(a.estados.at(-1).fase, 'superficie');
  a.avancarTempo(300); a.controle.atualizar(a.quadro(null));
  assert.equal(a.reticulo.visible, false);
  assert.equal(a.controle.colocar(), false);
  await a.controle.sair();
});

test('movimento grande ou perda de rastreamento invalida o ponto anterior imediatamente', async () => {
  const a = ambiente(); await a.controle.iniciar();
  a.controle.atualizar(a.quadro(new Matrix4()));
  a.camera.position.x += 0.2; a.camera.updateMatrixWorld();
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.controle.colocar(), false);
  a.controle.atualizar(a.quadro(new Matrix4()));
  a.controle.atualizar(a.quadro(null, false));
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.controle.colocar(), false);
  await a.controle.sair();
});

test('não confirma um ponto vencido quando nenhum quadro novo chegou', async () => {
  const a = ambiente(); await a.controle.iniciar();
  a.controle.atualizar(a.quadro(new Matrix4()));
  a.avancarTempo(400);
  assert.equal(a.controle.colocar(), false);
  await a.controle.sair();
});

test('permissão negada mantém o modo 3D utilizável', async () => {
  const a = ambiente(async () => { throw new DOMException('negado', 'NotAllowedError'); });
  await a.controle.iniciar();
  assert.equal(a.estados.at(-1).fase, '3d');
  assert.match(a.estados.at(-1).mensagem, /não foi autorizada/);
});

test('desmontar durante a permissão encerra a sessão tardia e não atualiza a tela desmontada', async () => {
  let resolver;
  const a = ambiente(() => new Promise((r) => { resolver = r; }));
  let encerramentos = 0;
  const inicio = a.controle.iniciar(); a.controle.destruir();
  resolver({ end: async () => { encerramentos++; } });
  await inicio;
  assert.equal(encerramentos, 1);
  assert.equal(a.estados.length, 1);
});

test('hit-test que termina depois da saída é cancelado e não reabre AR', async () => {
  const a = ambiente(); let resolver;
  a.sessao.requestHitTestSource = () => new Promise((r) => { resolver = r; });
  const inicio = a.controle.iniciar();
  for (let i = 0; !resolver && i < 100; i++) await new Promise((r) => setImmediate(r));
  assert.ok(resolver, 'a solicitação de hit-test deve iniciar');
  await a.controle.sair();
  let cancelado = false; resolver({ cancel: () => { cancelado = true; } }); await inicio;
  assert.equal(cancelado, true);
  assert.equal(a.estados.at(-1).fase, '3d');
});

test('receitas preservam as escolhas e sem queijo também remove o maçarico', () => {
  const p = pedidoDaURL(new URLSearchParams('pao=roseta&pasta=tradicional&creme=sem&queijo=sem'), 'costela');
  const passos = sequencia(LANCHES.costela, p.opcoes);
  assert.deepEqual(passos.map((p) => p.id), ['pasta', 'costela', 'tampa']);
  assert.equal(estacao(passos[0], p.opcoes), 'pasta:tradicional');
  assert.equal(sequencia(LANCHES.dogalho, null).length, 7);
});

test('as escolhas vão e voltam entre AR e bancada; parâmetros inválidos não entram no pedido', () => {
  const p = pedidoDaURL(new URLSearchParams('pao=roseta&pasta=sem&creme=4-queijos&queijo=colonial&bebida=soda&sabor=maca-verde&porcao=dadinho'), 'pulled');
  const url = urlDoPedido(p, '/ar');
  assert.deepEqual(pedidoDaURL(new URLSearchParams(url.split('?')[1]), 'pulled'), p);
  const invalido = pedidoDaURL(new URLSearchParams('pao=sem&pasta=inventado&bebida=lata&sabor=__proto__&porcao=qualquer'), 'costela');
  assert.equal(invalido.opcoes.pao, null); assert.equal(invalido.opcoes.pasta, null);
  assert.equal(invalido.bebida, null); assert.equal(invalido.porcao, null);
});

test('plano local acompanha translação e rotação da âncora sem mudar sua geometria', () => {
  const { Plane } = require('three');
  const plano = new Plane(new Vector3(1, 0, 0), 0.1);
  const ancora = new Matrix4().compose(new Vector3(1, 0.7, -2), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.8), new Vector3(1, 1, 1));
  const ponto = new Vector3(-0.1, 0.05, 0.03).applyMatrix4(ancora);
  assert.ok(Math.abs(plano.clone().applyMatrix4(ancora).distanceToPoint(ponto)) < 1e-8);
  assert.equal(plano.constant, 0.1);
});

test('trocar lanche libera clones e preserva geometria e texturas do cache GLTF', () => {
  const { BoxGeometry, MeshStandardMaterial, Texture } = require('three');
  const fonte = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new Texture() }));
  const clone = new Mesh(fonte.geometry, fonte.material.clone());
  const gerado = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new Texture() }));
  let liberados = 0, protegidos = 0;
  for (const r of [clone.material, gerado.geometry, gerado.material, gerado.material.map]) r.addEventListener('dispose', () => liberados++);
  for (const r of [fonte.geometry, fonte.material, fonte.material.map]) r.addEventListener('dispose', () => protegidos++);
  liberarMontagem([clone, gerado], [fonte]);
  assert.equal(liberados, 4); assert.equal(protegidos, 0);
});
