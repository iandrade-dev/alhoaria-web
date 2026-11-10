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
O reaproveitamento atual é do frontend; receitas e assets da montagem ainda são específicos da Alhoaria.

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

## Pendências do cliente

- Confirmar o WhatsApp oficial para pedidos.
- Enviar fotos em alta definição.
- Enviar logo vetorial.
- Confirmar o link do Maps da unidade Pedra Branca.
- Confirmar telefone das unidades.
