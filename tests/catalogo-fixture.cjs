const itens = require('../scripts/catalogo-inicial.json');
const publicacao = {
  schemaVersion: 1, publicationId: 'fixture-v1', publicationVersion: 1, publishedAt: '2026-11-24T00:00:00.000Z',
  company: { id: 'empresa-fixture', publicSlug: 'alhoaria', currency: 'BRL', brandName: 'Alhoaria', checkout: { type: 'anota_ai', handoff: 'recreate_order' } },
  categories: [],
  products: itens.map(({ category, foto, ...produto }, sortOrder) => ({
    id: 'produto-' + produto.reference, categoryId: category, description: '', available: true, sortOrder,
    variants: [], optionGroups: [], ingredients: [], photos: foto ? [{ url: '/' + foto }] : [], model3d: null,
    ...produto,
  })),
};
module.exports = { publicacao };
