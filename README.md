# Alhoaria — cardápio e experiência 3D

Landing de uma página para a Alhoaria, lanchonete de Palhoça/SC com lanches no pão de alho gratinado no maçarico.

## Pedido e configuração

`/pedir` oferece a escolha inicial entre cardápio simples (`/cardapio`) e experiência 3D (`/bancada`).
A mesma sacola aceita vários lanches personalizados, bebidas e porções avulsas, com quantidade,
edição, remoção e recuperação local após recarregar. Adicionar um lanche na bancada libera a escolha do próximo.
O modo simples não monta um canvas 3D. Falhas de WebGL ou de carregamento oferecem recuperação nele.

Identidade, cores, domínio, unidades e destino do checkout ficam em `src/data/restaurante.ts`;
o catálogo compartilhado em `src/data/catalogo.ts`. O checkout externo pode ser trocado por WhatsApp
em `src/lib/checkout.ts`. No Anota AI, a pessoa precisa refazer o pedido: não há transferência automática.
As bancadas da Alhoaria e da Strawberry importam ingredientes procedurais, movimentos,
controles de órbita e a sessão WebXR de `@cardapios/bancada-3d`. Cada site fornece sua
cena, os dados da receita e os modelos usados no pedido.
O [código e a publicação do pacote](packages/bancada-3d/README.md) ficam neste repositório.

A home começa com foto e conteúdo renderizado no servidor. O vídeo principal só carrega ao tocar
em “Ver a história do lanche”. A faixa de montagem usa imagem em economia de dados/aparelhos modestos;
o 3D reduz resolução e sombras e pausa renderização com a sacola aberta ou página oculta.
Detalhes da pesquisa e validação em `docs/EVOLUCAO-FRONTEND.md`.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion e fontes locais via `@fontsource`.

## Rodar localmente

```bash
npm ci
npm run dev
```

## Cardápio em 3D e realidade aumentada

`/bancada` e `/ar` abrem a mesma experiência e o mesmo estado de pedido. Na entrada, a pessoa
escolhe **Montar na bancada** ou **Montar na minha mesa**. Não há navegação para outra montagem.
Os dois ambientes compartilham pão, ingredientes, adicionais, bebidas, porções, combo, sacola e comanda.
Na etapa Turbinar, tocar no potinho seleciona e mostra só seus controles +/−; arrastar o potinho 3D até o pão
adiciona uma dose. Soltar fora devolve sem adicionar. Pastas e cremes separados ficam numa bandeja recolhida.
O pedido é copiado e finalizado na loja do Anota AI; o site não preenche o carrinho externo automaticamente.

Em Android com WebXR compatível, por HTTPS, a escolha da mesa abre a câmera (depois de escolher um lanche,
se necessário). **Posicionar manualmente** coloca o conjunto à frente do aparelho sem esperar uma superfície:
ajuste altura e distância e confirme em **Pronto, ficou bom**. A detecção de superfície é opcional.
**Ajustar posição** reabre os ajustes. Zoom por botões e pinça e giro transformam todo o conjunto.
**Voltar à bancada** encerra só a câmera: a etapa, os objetos, os adicionais, as bebidas e o pedido permanecem.
Perder o rastreamento pausa tanto a montagem quanto as animações do pedido e os ajustes.

A cozinha e as sombras de contato ficam ocultas na câmera. A mesma cena e o mesmo canvas permanecem
montados, com projeções dos ingredientes, bebidas e sacola corrigidas pela posição, giro e tamanho em AR.
Sem WebXR, entra direto na bancada, sem exibir a opção AR; sem WebGL, há acesso ao modo simples.
Não há captura ou envio de imagens da câmera.

Verificação: `npm run test:ar` cobre ciclo de sessão, permissões, superfície horizontal, posição manual sem
hit-test (ou com resposta tardia), ajustes absolutos e limitados, pose inválida, reposicionamento,
perda de rastreamento, saída durante carregamento, escolhas/URLs e descarte de recursos.
A câmera, o tamanho percebido e o rastreamento em uma mesa real ainda exigem validação em aparelho físico.

## Modo garçom (equipe)

O pedido do cliente continua igual: sacola no site e finalização no Anota AI. `/garcom` é só da equipe:
não aparece na navegação pública nem no sitemap e tem `noindex`/`nofollow`. O cabeçalho público e a sacola
do cliente ficam ocultos nessa rota.

Fluxo no celular: entrar com a conta do painel (e-mail e senha), escolher a loja quando houver mais de uma,
informar a mesa, adicionar itens do mesmo catálogo do cardápio (lanche padrão com “+”, ou “Opções” para
ingredientes, adicionais, potinhos, combo, bebida e porção junto), revisar a comanda, escrever uma observação
opcional e tocar em **Enviar para a cozinha**. A confirmação mostra o número do pedido; a aba **Pedidos de hoje**
atualiza o status a cada 5 s (pausa com a aba oculta) e permite cancelar pedidos ainda na fila.
A cozinha fica no painel da plataforma, aberto no endereço próprio do painel (não por este site).

- A sessão é o cookie `HttpOnly` da plataforma (login `client: "web"`); ao recarregar, `GET /v1/identity/session`
  restaura a sessão e o token CSRF das mutações (`x-csrf-token`), como o cliente do painel.
- A comanda em andamento fica guardada no aparelho (`localStorage`): queda de rede, plataforma fora do ar ou
  sessão expirada não apagam nada. Cada envio usa um `idempotency-key` gerado uma vez e guardado com a comanda;
  “Tentar enviar de novo” repete a mesma chave e não duplica o pedido. Mudar a comanda gera chave nova.
- Contas com papel `kitchen` só acompanham a lista; `admin` e `waiter` enviam e cancelam.
- Contrato da API num só lugar: `src/lib/garcom-api.ts`. Montagem do corpo, totais e chave: `src/lib/garcom-pedido.ts`.
  Cada linha da comanda vira itens da cozinha: o lanche (ingredientes, adicionais e potinhos nos `details`
  e no `unitPriceCents`) e, separados, a bebida e a porção que vieram junto dele.

### Proxy da plataforma

`next.config.mjs` reescreve para a plataforma só as rotas do garçom (`/v1/identity/sessions`, `/v1/identity/session`,
`/v1/me/workplaces` e `/v1/companies/:id/orders[/:orderId/cancel]`), na mesma origem. O painel e as demais rotas
da API não passam por este site.
(o cookie de sessão é host-only, então o navegador precisa falar com o próprio site):

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `PLATFORM_ORIGIN` | `https://vps-16302377.tail7dc411.ts.net:10000` | Origem da API e do painel. Vazia (`PLATFORM_ORIGIN=`) ou inválida desliga o proxy; o build continua. |

A origem pública deste site (por exemplo `https://alhoaria-web.vercel.app` e `http://localhost:3000` no
desenvolvimento) precisa estar em `WAITER_SITE_ORIGINS` da plataforma (e não em `ALLOWED_ORIGINS`): o login web é recusado sem uma origem
permitida.

Verificação: `npm run test:garcom` cobre a conversão da sacola em itens da cozinha, totais, validação de mesa e
observação, rascunho guardado, filtro de pedidos do dia, reaproveitamento da chave de idempotência, CSRF e
classificação de erros (401, 403, 409, rede/5xx, validação). Capturas em 390×844 com a API simulada: `qa/garcom/`.

## Pendências do cliente

- Confirmar o WhatsApp oficial para pedidos.
- Enviar fotos em alta definição.
- Enviar logo vetorial.
- Confirmar o link do Maps da unidade Pedra Branca.
- Confirmar telefone das unidades.
