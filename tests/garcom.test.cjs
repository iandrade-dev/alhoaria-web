const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../.ar-tests/garcom/lib/garcom-pedido.js');
const api = require('../.ar-tests/garcom/lib/garcom-api.js');
const s = require('../.ar-tests/garcom/lib/sacola.js');
const { criarCardapio } = require('../.ar-tests/garcom/components/bancada-proto/cardapio.js');
const { publicacao } = require('./catalogo-fixture.cjs');
const cardapio = criarCardapio(publicacao);

const lanche = (id, pedido, quantidade = 1) => ({ id, quantidade, conteudo: { tipo: 'lanche', pedido } });
const padrao = (id) => cardapio.pedidoPadrao(id);

test('lanche completo vira itens da cozinha com detalhes e preço unitário', () => {
  const p = padrao('costela');
  const refri = { id: 'lata', sabor: 'pureza' };
  Object.assign(p, { adicionais: { bacon: 2 }, separados: { 'creme-cheddar': 1 }, bebida: refri, porcao: 'dadinho' });
  const item = lanche('a', p, 3);
  const itens = g.itensDaLinha(item, cardapio);
  assert.equal(itens.length, 3);
  assert.equal(itens[0].name, 'A Costela!');
  assert.equal(itens[0].quantity, 3);
  assert.equal(itens[0].unitPriceCents, 4490 + 1200 + 400);
  assert.ok(itens[0].details.some((d) => /Bacon.* x2$/.test(d)));
  assert.ok(itens[0].details.some((d) => /separado/.test(d)));
  assert.ok(itens[0].details.some((d) => /Pão/.test(d)), 'ingredientes escolhidos seguem nos detalhes');
  assert.deepEqual(itens.slice(1).map((i) => [i.name, i.quantity, i.unitPriceCents]), [[cardapio.nomeBebida(refri), 3, cardapio.precoBebida(refri)], [cardapio.PORCOES.dadinho.nome, 3, cardapio.PORCOES.dadinho.preco]]);
  assert.ok(!itens.some((i) => /^\d+x /.test(i.name) || /a partir de/.test(i.name)), 'nomes sem quantidade nem "a partir de"');
  assert.equal(g.totalDosItens(itens), s.totalDoItem(item, cardapio));
});

test('combo, bebida e porção avulsas mantêm o total da sacola', () => {
  const combo = padrao('dogalho'); combo.combo = true; combo.bebida = { id: 'lata', sabor: 'coca' };
  const itens = [lanche('combo', combo, 2), { id: 'b', quantidade: 2, conteudo: { tipo: 'bebida', bebida: { id: 'lata', sabor: 'pureza' } } }, { id: 'p', quantidade: 1, conteudo: { tipo: 'porcao', porcao: 'batata' } }];
  const pedido = g.itensDoPedido(itens, cardapio);
  assert.equal(pedido[0].quantity, 2);
  assert.ok(pedido[0].details.some((d) => /Coca/.test(d)), 'a lata do combo aparece nos detalhes');
  assert.equal(pedido.length, 3, 'a lata do combo não vira um item cobrado à parte');
  assert.equal(g.totalDosItens(pedido), g.totalDaComanda(itens, cardapio));
  for (const i of pedido) assert.ok(Number.isInteger(i.unitPriceCents) && i.unitPriceCents > 0);
});

test('produto publicado sem bancada usa variante e adicionais da publicação na comanda', () => {
  const produto = {
    id: 'mousse', name: 'Mousse', description: '', categoryId: null, priceCents: 1000, available: true,
    sortOrder: 99, photos: [], model3d: null, ingredients: [],
    variants: [{ id: 'grande', label: 'Grande', priceCents: 1450, available: true }],
    optionGroups: [{ id: 'extra', name: 'Extras', min: 0, max: 1,
      options: [{ id: 'calda', name: 'Calda', priceCents: 250, available: true }] }],
  };
  const publicado = criarCardapio({ ...publicacao, products: [...publicacao.products, produto] });
  const conteudo = { ...publicado.produtoPadrao(produto), opcoes: ['calda'] };
  const resultado = g.montarPedido('5', '', [{ id: 'doce', conteudo, quantidade: 2 }], publicado);
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.pedido.items, [{ name: 'Mousse', quantity: 2, unitPriceCents: 1700, details: ['Grande · Calda'] }]);
});

test('montarPedido exige mesa e itens, limpa mesa e observação', () => {
  const itens = [lanche('a', padrao('pulled'))];
  assert.deepEqual(g.montarPedido('  ', '', itens, cardapio), { ok: false, erro: 'Informe a mesa.' });
  assert.deepEqual(g.montarPedido('5', '', [], cardapio), { ok: false, erro: 'Adicione ao menos um item.' });
  const r = g.montarPedido('  12   B ', '  sem cebola ', itens, cardapio);
  assert.equal(r.ok, true);
  assert.equal(r.pedido.table, '12 B');
  assert.equal(r.pedido.note, 'sem cebola');
  assert.equal(g.montarPedido('7', '   ', itens, cardapio).pedido.note, undefined, 'observação vazia não vai no corpo');
});

test('a chave de idempotência se repete no reenvio e muda quando a comanda muda', () => {
  let n = 0; const nova = () => `chave-${++n}`;
  const pedido = g.montarPedido('5', '', [lanche('a', padrao('brocolis'))], cardapio).pedido;
  const a = g.assinaturaDoEnvio('empresa-1', pedido);
  const primeira = g.chaveDoEnvio(null, a, nova);
  assert.equal(primeira.chave, 'chave-1');
  assert.equal(g.chaveDoEnvio(primeira, a, nova).chave, 'chave-1', 'mesmo pedido: mesma chave');
  const outro = g.montarPedido('5', '', [lanche('a', padrao('brocolis'), 2)], cardapio).pedido;
  assert.equal(g.chaveDoEnvio(primeira, g.assinaturaDoEnvio('empresa-1', outro), nova).chave, 'chave-2', 'quantidade mudou: chave nova');
  assert.equal(g.chaveDoEnvio(primeira, g.assinaturaDoEnvio('empresa-2', pedido), nova).chave, 'chave-3', 'outra empresa: chave nova');
});

test('uma tentativa incerta conserva corpo e chave após publicar outro preço', () => {
  const rascunho = { ...g.rascunhoVazio(), mesa: '5', itens: [lanche('a', padrao('pulled'))] };
  const tentativa = g.prepararEnvio(rascunho, cardapio, 1000, () => 'chave-anterior');
  assert.equal(tentativa.ok, true);
  assert.equal(tentativa.pedido.items[0].unitPriceCents, 3590);
  const atualizada = structuredClone(publicacao);
  atualizada.products.find((p) => p.reference === 'pulled').priceCents = 4190;
  const novoCardapio = criarCardapio(atualizada);
  const salvo = JSON.stringify({ ...rascunho, pendente: tentativa.pendente });
  const recuperado = g.lerRascunho(salvo, novoCardapio);
  assert.equal(g.montarPedido('5', '', recuperado.itens, novoCardapio).pedido.items[0].unitPriceCents, 4190);
  assert.deepEqual(g.prepararEnvio(recuperado, novoCardapio, 2000, () => 'chave-nova'), tentativa);
  const expirado = g.prepararEnvio(recuperado, novoCardapio, 1000 + 24 * 60 * 60 * 1000, () => 'chave-nova');
  assert.equal(expirado.ok, false);
  const alterado = { ...recuperado, itens: [{ ...recuperado.itens[0], quantidade: 2 }] };
  const proximo = g.prepararEnvio(alterado, novoCardapio, 2000, () => 'chave-nova');
  assert.equal(proximo.pendente.chave, 'chave-nova');
  assert.equal(proximo.pedido.items[0].unitPriceCents, 4190);

  atualizada.products.find((p) => p.reference === 'pulled').available = false;
  const semPulled = criarCardapio(atualizada);
  const indisponivel = g.lerRascunho(salvo, semPulled);
  assert.equal(indisponivel.revisar, true);
  assert.equal(g.prepararEnvio(indisponivel, semPulled, 2000, () => 'chave-nova').ok, false);
});

test('rascunho guardado sobrevive e descarta itens inválidos', () => {
  const r = { versao: 1, mesa: '4', observacao: 'x', itens: [lanche('a', padrao('dogalho')), { id: 'z', quantidade: 0, conteudo: {} }], pendente: { chave: 'k', assinatura: 's' } };
  const lido = g.lerRascunho(JSON.stringify(r), cardapio);
  assert.equal(lido.itens.length, 1); assert.equal(lido.mesa, '4'); assert.deepEqual(lido.pendente, { chave: 'k', assinatura: 's' });
  assert.deepEqual(g.lerRascunho('{', cardapio), g.rascunhoVazio());
  assert.deepEqual(g.lerRascunho(JSON.stringify({ versao: 2, itens: [] }), cardapio), g.rascunhoVazio());
});

test('pedidos de hoje: só o dia local, mais recentes primeiro', () => {
  const agora = new Date(2026, 10, 20, 21, 0);
  const em = (h, d = 20) => new Date(2026, 10, d, h, 0).toISOString();
  const lista = [{ id: 'ontem', createdAt: em(22, 19) }, { id: 'cedo', createdAt: em(19) }, { id: 'tarde', createdAt: em(20) }, { id: 'ruim', createdAt: 'x' }];
  assert.deepEqual(g.pedidosDeHoje(lista, agora).map((p) => p.id), ['tarde', 'cedo']);
});

function fetchFalso(respostas) {
  const chamadas = [];
  const fetcher = async (url, init) => {
    chamadas.push({ url, init, headers: init.headers, body: init.body && JSON.parse(init.body) });
    const r = respostas.shift();
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  return { fetcher, chamadas };
}
const pedidoApi = { id: 'o1', companyId: 'e1', number: 7, table: '5', note: null, items: [], totalCents: 3590, status: 'queued', createdBy: { name: 'Ana' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

test('cliente: login web guarda o CSRF e o envia nas mutações com a chave', async () => {
  const { fetcher, chamadas } = fetchFalso([
    { status: 201, body: { user: { id: 'u', email: 'a@b.c', displayName: 'Ana', role: 'member' }, csrfToken: 'csrf-1' } },
    new TypeError('Failed to fetch'),
    { status: 201, body: pedidoApi },
  ]);
  const cliente = api.criarClienteGarcom(fetcher);
  await cliente.entrar('a@b.c', 'segredo');
  assert.deepEqual(chamadas[0].body, { email: 'a@b.c', password: 'segredo', client: 'web' });
  assert.equal(chamadas[0].url, api.ROTAS.login);
  assert.equal(chamadas[0].init.credentials, 'include');
  const corpo = g.montarPedido('5', '', [lanche('a', padrao('pulled'))], cardapio).pedido;
  const err = await cliente.enviar('e1', corpo, 'chave-fixa').catch((e) => e);
  assert.ok(err instanceof api.ErroGarcom); assert.equal(err.tipo, 'indisponivel'); assert.equal(err.repetivel, true);
  const ok = await cliente.enviar('e1', corpo, 'chave-fixa');
  assert.equal(ok.number, 7);
  for (const ch of chamadas.slice(1)) {
    assert.equal(ch.url, '/v1/companies/e1/orders');
    assert.equal(ch.headers['idempotency-key'], 'chave-fixa');
    assert.equal(ch.headers['x-csrf-token'], 'csrf-1');
  }
});

test('cliente: classifica 401, 403, 409, 5xx e validação', async () => {
  const { fetcher } = fetchFalso([
    { status: 401, body: { error: { code: 'unauthenticated' } } },
    { status: 403, body: { error: { code: 'forbidden' } } },
    { status: 409, body: { error: { code: 'order_status_changed', message: 'mudou' } } },
    { status: 503, body: undefined },
    { status: 400, body: { error: { message: 'inválido', details: [{ path: 'table', message: 'obrigatória' }] } } },
    { status: 401, body: {} },
  ]);
  const cliente = api.criarClienteGarcom(fetcher);
  const tipos = [];
  for (let i = 0; i < 5; i++) tipos.push(await cliente.pedidos('e1').catch((e) => [e.tipo, e.status, e.message]));
  assert.deepEqual(tipos.map((t) => t[0]), ['sessao', 'permissao', 'conflito', 'indisponivel', 'invalido']);
  assert.match(tipos[4][2], /Mesa inválida/);
  const login = await cliente.entrar('x', 'y').catch((e) => e);
  assert.equal(login.tipo, 'invalido'); assert.match(login.message, /senha/);
});

test('cliente: cancelar manda o status de origem', async () => {
  const { fetcher, chamadas } = fetchFalso([{ status: 200, body: { ...pedidoApi, status: 'canceled' } }]);
  const r = await api.criarClienteGarcom(fetcher).cancelar('e1', pedidoApi);
  assert.equal(chamadas[0].url, '/v1/companies/e1/orders/o1/cancel');
  assert.deepEqual(chamadas[0].body, { from: 'queued' });
  assert.equal(r.status, 'canceled');
  assert.equal(api.podeEnviar('kitchen'), false); assert.equal(api.podeEnviar('waiter'), true);
});
