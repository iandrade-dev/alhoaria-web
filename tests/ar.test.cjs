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

test('voltar à bancada enquanto aguarda a câmera libera a tela e encerra a sessão tardia', async () => {
  let resolver, encerramentos = 0;
  const a = ambiente(() => new Promise((r) => { resolver = r; }));
  const inicio = a.controle.iniciar();
  await a.controle.sair();
  assert.equal(a.estados.at(-1).fase, '3d');
  assert.equal(a.origem.visible, true);
  resolver({ end: async () => { encerramentos++; } }); await inicio;
  assert.equal(encerramentos, 1);
  assert.equal(a.estados.at(-1).fase, '3d');
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

test('posição manual funciona sem hit-test e não depende de uma superfície', async () => {
  let recursos;
  const a = ambiente((modo, opcoes) => { recursos = opcoes; return Promise.resolve(a.sessao); });
  a.sessao.requestHitTestSource = async () => { throw new Error('indisponível'); };
  await a.controle.iniciar();
  assert.deepEqual(recursos.requiredFeatures, ['dom-overlay']);
  assert.deepEqual(recursos.optionalFeatures, ['hit-test']);
  assert.equal(a.controle.colocarManualmente(), false, 'espera uma pose válida da câmera');
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.estados.at(-1).podeManual, true);
  assert.equal(a.controle.colocarManualmente(), true);
  assert.equal(a.estados.at(-1).fase, 'ajustando');
  assert.deepEqual(a.origem.position.toArray(), [0, 0.65, 0.35]);
  a.controle.ajustarAltura(0.2); a.controle.ajustarAltura(0.2);
  assert.ok(Math.abs(a.origem.position.y - 0.85) < 1e-8, 'altura absoluta não acumula');
  a.controle.ajustarAltura(99); a.controle.ajustarDistancia(99);
  assert.equal(a.estados.at(-1).ajusteAltura, 0.6);
  assert.equal(a.estados.at(-1).ajusteDistancia, 1.5);
  a.controle.ajustarAltura(NaN); a.controle.ajustarDistancia(Infinity);
  assert.ok(a.origem.position.toArray().every(Number.isFinite));
  assert.equal(a.controle.confirmarManual(), true);
  const fixo = a.origem.position.toArray();
  a.camera.position.x += 1; a.camera.updateMatrixWorld();
  a.controle.atualizar(a.quadro(new Matrix4().makeTranslation(9, 9, 9)));
  assert.deepEqual(a.origem.position.toArray(), fixo, 'câmera e superfícies não puxam o lanche');
  assert.equal(a.controle.editarPosicao(), true);
  assert.deepEqual(a.origem.position.toArray(), fixo, 'abrir ajustes não provoca salto');
  a.controle.atualizar(a.quadro(null, false));
  a.controle.ajustarAltura(-0.2);
  assert.equal(a.controle.confirmarManual(), false);
  assert.deepEqual(a.origem.position.toArray(), fixo);
  assert.equal(a.origem.visible, false);
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.origem.visible, true);
  a.referencia.dispatchEvent(new Event('reset'));
  assert.equal(a.controle.colocarManualmente(), false);
  assert.equal(a.estados.at(-1).manual, false);
  await a.controle.sair();
});

test('posição manual fica disponível enquanto hit-test demora e ignora o resultado tardio', async () => {
  const a = ambiente(); let resolver;
  a.sessao.requestHitTestSource = () => new Promise((r) => { resolver = r; });
  const inicio = a.controle.iniciar();
  for (let i = 0; !resolver && i < 100; i++) await new Promise((r) => setImmediate(r));
  assert.ok(resolver);
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.controle.colocarManualmente(), true);
  const fixo = a.origem.position.toArray();
  resolver({ cancel() {} }); await inicio;
  a.controle.atualizar(a.quadro(new Matrix4().makeTranslation(9, 9, 9)));
  assert.deepEqual(a.origem.position.toArray(), fixo);
  assert.equal(a.estados.at(-1).fase, 'ajustando');
  await a.controle.sair();
});

test('pose inválida bloqueia posição manual; olhar para baixo mantém direção horizontal válida', async () => {
  const a = ambiente(); await a.controle.iniciar();
  a.camera.matrixWorld.elements[0] = NaN;
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.estados.at(-1).podeManual, false);
  assert.equal(a.controle.colocarManualmente(), false);
  a.camera.rotation.x = -Math.PI / 2; a.camera.updateMatrixWorld();
  a.controle.atualizar(a.quadro(null));
  assert.equal(a.controle.colocarManualmente(), true);
  assert.ok(a.origem.position.toArray().every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(a.origem.position.x - a.camera.position.x, a.origem.position.z - a.camera.position.z) - 0.65) < 1e-8);
  await a.controle.sair();
});

test('entrar, ajustar, perder rastreamento e sair da câmera preservam a mesma montagem e pedido', async () => {
  const a = ambiente();
  const cena = new Group(); const lanche = new Mesh(), bebida = new Mesh();
  cena.add(lanche, bebida); a.origem.add(cena);
  const pedido = { lanche: 'pulled', feitos: 3, adicionais: { bacon: 2 }, bebida: { id: 'soda', sabor: 'maca-verde' }, combo: true };
  cena.userData.pedido = pedido;
  lanche.position.set(0.1, 0.05, 0.02); bebida.position.set(0.2, 0, -0.1);
  await a.controle.iniciar(); a.controle.atualizar(a.quadro(null));
  a.controle.colocarManualmente(); a.controle.ajustarAltura(0.2); a.controle.confirmarManual();
  a.controle.atualizar(a.quadro(null, false)); a.controle.atualizar(a.quadro(null));
  await a.controle.sair();
  assert.equal(a.origem.children[0], cena);
  assert.equal(cena.children[0], lanche); assert.equal(cena.children[1], bebida);
  assert.equal(cena.userData.pedido, pedido);
  assert.equal(pedido.feitos, 3); assert.equal(pedido.adicionais.bacon, 2); assert.equal(pedido.combo, true);
  assert.deepEqual(lanche.position.toArray(), [0.1, 0.05, 0.02]);
  assert.deepEqual(bebida.position.toArray(), [0.2, 0, -0.1]);
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

test('alternar do 3D ao simples preserva extras, potinhos, combo e bebida do pedido', () => {
  const p = pedidoDaURL(new URLSearchParams('pao=roseta&pasta=sem&creme=4-queijos&queijo=colonial&bebida=chopp&porcao=dadinho'), 'pulled');
  p.adicionais = { bacon: 2, 'tomate-seco': 1 };
  p.separados = { 'pasta-ervas': 3 };
  p.combo = true; p.lataCombo = 'pureza';
  const url = urlDoPedido(p, '/cardapio');
  assert.deepEqual(pedidoDaURL(new URLSearchParams(url.split('?')[1]), 'pulled'), p);
  const invalido = pedidoDaURL(new URLSearchParams('adicional.bacon=999&separado.__proto__=1&lataCombo=__proto__'), 'pulled');
  assert.deepEqual(invalido.adicionais, {}); assert.deepEqual(invalido.separados, {}); assert.equal(invalido.lataCombo, null);
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

test('liberação inclui objetos destacados e não toca no kit ou nas mãos compartilhadas', () => {
  const { BoxGeometry, MeshStandardMaterial, Texture } = require('three');
  const texturaCompartilhada = new Texture();
  const geoKit = new BoxGeometry(), matKit = new MeshStandardMaterial({ map: texturaCompartilhada });
  const kit = new Group(); kit.add(new Mesh(geoKit, matKit));
  const mao = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const raiz = new Group(), proprio = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new Texture() }));
  const destacado = new Mesh(geoKit, new MeshStandardMaterial({ map: texturaCompartilhada }));
  raiz.add(proprio); raiz.add(destacado); destacado.removeFromParent();
  let liberados = 0, protegidos = 0;
  for (const r of [proprio.geometry, proprio.material, proprio.material.map, destacado.material]) r.addEventListener('dispose', () => liberados++);
  for (const r of [geoKit, matKit, texturaCompartilhada, mao.geometry, mao.material]) r.addEventListener('dispose', () => protegidos++);
  liberarMontagem([raiz, destacado, proprio], [kit, mao]);
  assert.equal(liberados, 4, 'cada recurso próprio é liberado uma única vez');
  assert.equal(protegidos, 0, 'fontes e recursos compartilhados permanecem intactos');
});
