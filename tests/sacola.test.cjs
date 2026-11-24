const test = require('node:test');
const assert = require('node:assert/strict');
const sacola = require('../.ar-tests/sacola/lib/sacola.js');
const { criarCardapio } = require('../.ar-tests/sacola/components/bancada-proto/cardapio.js');
const { publicacao } = require('./catalogo-fixture.cjs');
const c = criarCardapio(publicacao);
const s = {
  ...sacola,
  normalizarConteudo: (valor) => sacola.normalizarConteudo(valor, c),
  lerSacola: (raw) => sacola.lerSacola(raw, c),
  totalDoItem: (item) => sacola.totalDoItem(item, c),
  linhasDoItem: (item) => sacola.linhasDoItem(item, c),
  textoDaSacola: (itens) => sacola.textoDaSacola(itens, c),
  atualizarItem: (itens, id, conteudo) => sacola.atualizarItem(itens, id, conteudo, undefined, c),
};
const item = (id, pedido, quantidade = 1) => ({ id, quantidade, conteudo: { tipo: 'lanche', pedido } });
const envelope = itens => JSON.stringify({ versao: s.VERSAO_SACOLA, versaoCatalogo: '2026-11-21', itens });

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
  Object.assign(p, { opcoes: { pao: 'roseta', pasta: 'sem', creme: '4-queijos', queijo: 'colonial' }, adicionais: { bacon: 2 }, separados: { 'creme-cheddar': 1 }, bebida: { id: 'lata', sabor: 'fanta' }, porcao: 'dadinho', combo: true, lataCombo: 'pureza' });
  const x = item('a', p, 3), salvo = s.lerSacola(envelope([x]));
  assert.deepEqual(salvo.itens, [x]);
  // Anota AI, 21/11/2026: trio com A Costela soma R$ 11,00; a Fanta não é lata do trio e é cobrada à parte (R$ 7,00).
  assert.equal(s.totalDoItem(x), (5590 + 1100 + 1200 + 400 + 700 + 2990) * 3);
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
  for (const raw of ['{', JSON.stringify({versao: 99, versaoCatalogo: '2026-11-21', itens: []}), envelope([{ id: 'x', quantidade: 1, conteudo: { tipo: 'porcao', porcao: '__proto__' } }]), envelope([item('x', c.novoPedido('dogalho'), 0)]), envelope([item('x', c.novoPedido('dogalho'), 100)])]) assert.ok(s.lerSacola(raw).aviso);
  const p = c.novoPedido('dogalho'); p.adicionais.bacon = NaN;
  assert.equal(s.normalizarConteudo({tipo:'lanche', pedido:p}), null);
  p.adicionais.bacon = 13; assert.equal(s.normalizarConteudo({tipo:'lanche', pedido:p}), null);
  assert.equal(s.normalizarConteudo({tipo:'bebida', bebida:{id:'lata', sabor:'constructor'}}), null);
});
test('avulsos usam preços atuais e porção informa valor inicial', () => {
  const bebida = { id:'b', quantidade:2, conteudo:{tipo:'bebida', bebida:{id:'lata', sabor:'pureza'}} };
  const porcao = { id:'p', quantidade:1, conteudo:{tipo:'porcao', porcao:'batata'} };
  // Lata avulsa no Anota AI (21/11/2026): R$ 8,00, inclusive a Pureza.
  assert.equal(s.totalDoItem(bebida), 1600); assert.equal(s.totalDoItem(porcao), 2490);
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

test('trio cobra a proteína e só aceita as latas do próprio trio (Anota AI, 21/11/2026)', () => {
  const p = c.novoPedido('pulled');
  Object.assign(p, { opcoes: { pao: 'parmesao', pasta: 'ervas', creme: 'cheddar', queijo: 'mucarela' }, combo: true, bebida: { id: 'lata', sabor: 'coca' } });
  assert.equal(c.totalDoPedido(p), 5790);
  p.bebida = { id: 'lata', sabor: 'guarana' };
  assert.equal(c.saborDaLataDoCombo(p), null);
  assert.equal(c.totalDoPedido(p), 5790 + 700);
  p.lataCombo = 'pureza';
  assert.equal(c.saborDaLataDoCombo(p), 'pureza');
  const dog = c.novoPedido('dogalho'); dog.combo = true; dog.lataCombo = 'pureza';
  assert.equal(c.saborDaLataDoCombo(dog), null);
  assert.deepEqual(c.ORDEM_BEBIDAS, ['lata']);
});

test('uma publicação nova atualiza os preços de itens já salvos e preserva as outras linhas', () => {
  const nova = structuredClone(publicacao);
  nova.publicationId = 'fixture-v2';
  nova.products.find(p => p.reference === 'costela').priceCents = 4790;
  nova.products.find(p => p.reference === 'bebida-lata').variants.find(v => v.reference === 'pureza').priceCents = 650;
  nova.products.find(p => p.reference === 'dadinho').available = false;
  const vigente = criarCardapio(nova);
  const p = c.pedidoPadrao('costela');
  p.bebida = { id: 'lata', sabor: 'pureza' };
  const raw = JSON.stringify({ versao: sacola.VERSAO_SACOLA, empresa: c.companyId, publicacao: c.publicationId,
    itens: [item('a', p), { id: 'b', quantidade: 1, conteudo: { tipo: 'porcao', porcao: 'dadinho' } }] });
  const resultado = sacola.lerSacola(raw, vigente);
  assert.deepEqual(resultado.itens.map(i => i.id), ['a']);
  assert.ok(resultado.aviso);
  assert.equal(sacola.totalDoItem(resultado.itens[0], vigente), 5440);
});
