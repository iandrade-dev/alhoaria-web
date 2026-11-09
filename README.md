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
assistir à montagem (com pausa) ou montar tocando no ingrediente destacado ou arrastando-o até o lanche.
O botão **Fazer etapa** oferece a mesma ação sem arrastar. O painel recolhível permite trocar
lanche, pão, pasta, creme, queijo, bebida e porção. As escolhas acompanham os links entre `/ar` e `/bancada`.

Em Android com WebXR compatível, por HTTPS, **Ver na minha mesa** abre a câmera. **Posicionar manualmente**
coloca o conjunto à frente do aparelho sem esperar uma superfície: ajuste altura e distância e confirme
em **Pronto, ficou bom**. A detecção de superfície é opcional, com **Usar ponto detectado** quando disponível.
**Ajustar posição** reabre os ajustes sem reiniciar a detecção. Trocar o lanche preserva o lugar;
**Escolher outro lugar** inicia um novo posicionamento. Perder o rastreamento pausa a montagem e os ajustes.
Sem suporte a WebXR (inclusive iOS), o explorador 3D e as interações continuam disponíveis. Sem WebGL,
há acesso à bancada clássica. Não há captura ou envio de imagens da câmera.

O modo AR não inclui a cozinha nem as sombras de contato da bancada. Carrega o kit do lanche selecionado
e os acompanhamentos escolhidos, usa um único canvas, limita a densidade de pixels e libera recursos
gerados ao trocar de lanche. O preview parado renderiza sob demanda.

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
