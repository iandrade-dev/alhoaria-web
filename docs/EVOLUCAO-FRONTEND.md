# Evolução do cardápio — novembro de 2026

Escopo executado: frontend da Alhoaria, sem implementar painel, API, banco ou infraestrutura.

## Cinco rodadas de trabalho

1. **Evidências:** Luna pesquisou referências oficiais de acessibilidade, SEO e desempenho;
   Terra auditou a base existente. Os 28 GLBs somam cerca de 2,61 MiB comprimidos;
   o vídeo inicial existente tinha cerca de 3,60 MiB no desktop e 1,73 MiB no mobile.
   Esses valores medem arquivos, não memória GPU nem desempenho real de um aparelho.
2. **Fluxo:** Sol planejou a entrada simples/3D, catálogo e sacola compartilhada;
   Astra criticou dependências, escopo e preservação de escolhas.
3. **Implementação:** catálogo, sacola validada e versionada, edição, itens avulsos,
   checkout configurável e integração da bancada com vários itens.
4. **Revisão:** validação estrita de ingredientes e sabor de combo, descrição honesta
   do checkout, descarte de recursos próprios do 3D sem destruir assets compartilhados,
   recuperação de falhas e canonical próprio por rota.
5. **Validação:** testes de domínio/AR, build de produção e navegação mobile a 360 × 800,
   incluindo edição repetida, cancelamento, quantidade, recarga e composição com combo.

## Escolhas aplicadas

- Logo e identidade existentes, busca e categorias com alvos de toque de pelo menos 44 px.
- Foto e texto primeiro na home; vídeo principal e cena 3D carregados por escolha explícita.
- Modo leve automático por sinais do navegador e controle manual na bancada.
- Renderização suspensa durante sacola/página oculta; limpeza de recursos próprios da montagem.
- SSR do catálogo, metadados, canonical, Open Graph, sitemap, robots e Restaurant/Menu em JSON-LD.
- Configuração central de marca/cores/unidades/checkout; sem prometer geração genérica de receitas 3D.

## Referências primárias

- [WCAG: tamanho de alvos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Google: indexação mobile-first](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)
- [Google: dados de negócios locais](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [web.dev: Core Web Vitals](https://web.dev/articles/vitals)
- [Three.js: descarte de recursos](https://threejs.org/manual/en/how-to-dispose-of-objects.html)
- [Next.js: carregamento sob demanda](https://nextjs.org/docs/app/guides/lazy-loading)

## Limites da validação

Os testes locais não certificam Core Web Vitals, consumo de memória estabilizado ou desempenho
em celular antigo físico. Câmera/WebXR, escala percebida, calor e rastreamento precisam de teste
em aparelho compatível. O preço e a entrega são confirmados na loja; o Anota AI não importa esta sacola.
