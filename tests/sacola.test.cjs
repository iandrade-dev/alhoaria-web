const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../.ar-tests/sacola/lib/sacola.js');
const c = require('../.ar-tests/sacola/components/bancada-proto/cardapio.js');
const { restaurante } = require('../.ar-tests/sacola/data/restaurante.js');
const item = (id, pedido, quantidade = 1) => ({ id, quantidade, conteudo: { tipo: 'lanche', pedido } });
const envelope = itens => JSON.stringify({ versao: s.VERSAO_SACOLA, versaoCatalogo: restaurante.versaoCatalogo, itens });

test('rejeita escolhas pendentes e preserva escolhas sem', () => {
  const p = c.novoPedido('costela'); p.opcoes.pasta = 'sem';
  assert.equal(s.normalizarConteudo({ tipo: 'lanche', pedido: p }), null);
  p.opcoes = { ...c.OPCOES_PADRAO, pasta: 'sem' };
  const n = s.normalizarConteudo({ tipo: 'lanche', pedido: p });
  assert.equal(n.pedido.opcoes.pasta, 'sem');
  assert.notEqual(n.pedido.opcoes, p.opcoes);
});
test('composição completa, combo e multiplicador sobrevivem ao armazenamento', () => {
  const p = c.novoPedido('costela');
  Object.assign(p, { opcoes: { pao: 'roseta', pasta: 'sem', creme: '4-queijos', queijo: 'colonial' }, adicionais: { bacon: 2 }, separados: { 'creme-cheddar': 1 }, bebida: { id: 'chopp' }, porcao: 'dadinho', combo: true, lataCombo: 'pureza' });
  const x = item('a', p, 3), salvo = s.lerSacola(envelope([x]));
  assert.deepEqual(salvo.itens, [x]);
  assert.equal(s.totalDoItem(x), (5590 + 1200 + 400 + 990 + 2990) * 3);
  assert.match(s.textoDaSacola([x]), /Total estimado: R\$/);
});
test('linhas separadas, edição imutável e remoção preservam identidade', () => {
  const p = c.novoPedido('dogalho');
  const items = [item('primeiro', p, 2), item('segundo', p)];
  const novo = { ...p, adicionais: { bacon: 1 } };
  const atualizados = s.atualizarItem(items, 'primeiro', { tipo: 'lanche', pedido: novo });
  assert.equal(atualizados[0].id, 'primeiro'); assert.equal(atualizados[0].quantidade, 2);
  assert.equal(s.totalDoItem(atualizados[0]), (2690 + 600) * 2);
  assert.equal(s.totalDoItem(items[0]), 2690 * 2);
  assert.deepEqual(s.removerItem(atualizados, 'primeiro').map(i => i.id), ['segundo']);
  assert.equal(s.atualizarItem(items, 'ausente', { tipo: 'lanche', pedido: novo }), null);
});
test('rejeita dados inválidos, versões e chaves herdadas', () => {
  for (const raw of ['{', JSON.stringify({versao: 99, versaoCatalogo: restaurante.versaoCatalogo, itens: []}), envelope([{ id: 'x', quantidade: 1, conteudo: { tipo: 'porcao', porcao: '__proto__' } }]), envelope([item('x', c.novoPedido('dogalho'), 0)]), envelope([item('x', c.novoPedido('dogalho'), 100)])]) assert.ok(s.lerSacola(raw).aviso);
  const p = c.novoPedido('dogalho'); p.adicionais.bacon = NaN;
  assert.equal(s.normalizarConteudo({tipo:'lanche', pedido:p}), null);
  p.adicionais.bacon = 13; assert.equal(s.normalizarConteudo({tipo:'lanche', pedido:p}), null);
  assert.equal(s.normalizarConteudo({tipo:'bebida', bebida:{id:'lata', sabor:'constructor'}}), null);
});
test('avulsos usam preços atuais e porção informa valor inicial', () => {
  const bebida = { id:'b', quantidade:2, conteudo:{tipo:'bebida', bebida:{id:'lata', sabor:'pureza'}} };
  const porcao = { id:'p', quantidade:1, conteudo:{tipo:'porcao', porcao:'batata'} };
  assert.equal(s.totalDoItem(bebida), 1200); assert.equal(s.totalDoItem(porcao), 2490);
  assert.match(s.textoDaSacola([bebida,porcao]), /a partir de/);
});
test('combo exige sabor e não cobra novamente a lata incluída', () => {
  const p = c.novoPedido('dogalho'); p.combo = true;
  assert.equal(s.normalizarConteudo({tipo:'lanche', pedido:p}), null);
  p.bebida = { id:'lata', sabor:'coca' };
  const conteudo = s.normalizarConteudo({tipo:'lanche', pedido:p});
  assert.equal(s.totalDoItem({ id:'combo', quantidade:2, conteudo }), 3690 * 2);
  assert.match(s.linhasDoItem({ id:'combo', quantidade:2, conteudo })[0].texto, /^2x /);
});
