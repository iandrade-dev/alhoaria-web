# Alhoaria — landing MVP

Landing de uma página para a Alhoaria, lanchonete de Palhoça/SC com lanches no pão de alho gratinado no maçarico.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion e fontes locais via `@fontsource`.

## Rodar localmente

```bash
npm ci
npm run dev
```

## Cardápio em 3D e realidade aumentada

`/ar` reutiliza os quatro lanches e a montagem da bancada. É possível explorar o lanche pronto,
assistir à montagem (com pausa) ou montar uma etapa por toque. O painel recolhível permite trocar
lanche, pão, pasta, creme, queijo, bebida e porção. As escolhas acompanham os links entre `/ar` e `/bancada`.

Em Android com WebXR compatível, por HTTPS, **Ver na minha mesa** abre a câmera, procura uma superfície
horizontal e só posiciona o conjunto ao tocar em **Colocar aqui**. Trocar o lanche preserva o lugar;
**Escolher outro lugar** inicia um novo posicionamento. Perder o rastreamento pausa a montagem.
Sem suporte a WebXR (inclusive iOS), o explorador 3D e as interações continuam disponíveis. Sem WebGL,
há acesso à bancada clássica. Não há captura ou envio de imagens da câmera.

O modo AR não inclui a cozinha nem as sombras de contato da bancada. Carrega o kit do lanche selecionado
e os acompanhamentos escolhidos, usa um único canvas, limita a densidade de pixels e libera recursos
gerados ao trocar de lanche. O preview parado renderiza sob demanda.

Verificação: `npm run test:ar` cobre ciclo de sessão, permissões, superfície horizontal, reposicionamento,
perda de rastreamento, saída durante carregamento, escolhas/URLs e descarte de recursos.
A câmera, o tamanho percebido e o rastreamento em uma mesa real ainda exigem validação em aparelho físico.

## Pendências do cliente

- Confirmar o WhatsApp oficial para pedidos.
- Enviar fotos em alta definição.
- Enviar logo vetorial.
- Confirmar o link do Maps da unidade Pedra Branca.
- Confirmar telefone das unidades.
