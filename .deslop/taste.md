# Gosto do Igor — Alhoaria

Cada linha registra data e origem (`dito`, `ai-memory`, `git d1fb7eb` ou `auditoria`).

## Papel das telas

- **Home (`/`):** Esta tela existe para apresentar o lanche no pão de alho gratinado no maçarico com impacto visual e mostrar onde ficam as lojas e como pedir. Não é a tela do cardápio completo nem da sacola fechada. (16/11/2026, alinhado com `d1fb7eb`)
- **Escolha (`/pedir`):** Esta tela existe para a pessoa decidir entre ir direto ao cardápio rápido ou brincar de montar o lanche em 3D. Não é a tela de mostrar os produtos nem de configurar o pedido. (16/11/2026)
- **Cardápio simples (`/cardapio`):** Esta tela existe para a pessoa escolher, personalizar e juntar lanches, bebidas e porções na sacola sem esperar cena 3D. Não é uma vitrine institucional nem um passo a passo animado. (16/11/2026)
- **Bancada 3D e AR (`/bancada`, `/ar`):** Esta tela existe para a pessoa montar o lanche na tábua com as próprias mãos (ou ver montando no automático), escolher adicionais, bebida e acompanhamento na cozinha e fechar a comanda na sacola. Não é a tela de preencher formulário de opções. (16/11/2026, alinhado com `strawberryfood-web/.deslop/taste.md`)

## Escolhas

- **Hero cinematográfico primeiro:** abrir a Home com a experiência visual do vídeo e o botão "Ver como é feito", sem entupir a abertura com botões imediatos de pedido. (11/11/2026, `git d1fb7eb`)
- **Unidades com informação completa:** endereço, horário de funcionamento, telefone e link "Como chegar" visíveis em cada unidade ativa. (11/11/2026, `git d1fb7eb`)
- **Rótulos pequenos nas porções/estações da bancada:** manter o nome pequeno nos itens da bancada para ninguém ter que adivinhar o que é cada tigela/potinho no celular. (14/11/2026, `ai-memory` `strawberryfood-web`)
- **Dois modos na bancada sem perder escolhas:** "Monta pra mim" e toque/arraste direto, com saída discreta ("Sem ...", "Pular") em toda etapa opcional. (13–14/11/2026, `ai-memory`)
- **Identidade física nos painéis:** painéis com cara do universo da lanchonete (como a Comanda de papel serrilhado), evitando modais genéricos ou placas pretas coladas sem acabamento. (14–16/11/2026, `ai-memory` `autiena`)
- **Sinalizar itens fora da tela:** em faixas horizontais no celular (ex.: vídeos do Instagram), indicar claramente que existem mais itens e permitir avançar/navegar sem deixar cartão cortado sem contexto. (14/11/2026, `ai-memory` `autiena`)

## Rejeições e vetos

- **Barra fixa de pedido no rodapé do mobile:** removida explicitamente por poluir a leitura/imersão. (11/11/2026, `git d1fb7eb`)
- **Botões demais ou mesma ação repetida em toda linha:** uma ação principal por estado; nunca repetir dezenas de botões laranja idênticos quando uma lista compacta ou seletor por família resolve melhor. (13/11/2026, `ai-memory` + `deslop`)
- **Sobreposição de HUD sobre logo, controles ou comida:** barras superiores/inferiores nunca podem colidir com o logo, com a tábua nem entre si em telas de `360 px` e `390 px`. (14–16/11/2026, `ai-memory` + auditoria)
- **Sequestro de rolagem no Hero:** pular ou rolar além do Hero nunca pode jogar o usuário de volta para o topo/final do Hero. (16/11/2026, auditoria)
- **Textos genéricos com "cara de IA", explicação do óbvio ou pluralização robótica (`item(ns)`):** usar português natural e direto. (23/10–16/11/2026, `ai-memory`)

## Exceções da lista de checagem

- **Rótulos junto aos objetos 3D na bancada (estações e potinhos do Turbinar):** exceção explícita ao item "rótulo que repete o desenho" — o Igor pediu e valoriza rótulos curtos e legíveis para identificar cada ingrediente/tigela no celular sem ambiguidade. (14/11/2026, `ai-memory` `strawberryfood-web`)
- **Família tipográfica `Inter Variable` + `Anton` + `Caveat Brush`:** o projeto já consolidou `Inter Variable` como fonte de leitura e UI ao lado das fontes display/manual; manter a família da marca em vez de trocar por outra fonte neutra. (13/11/2026, `ai-memory`)
- **Duas entradas explícitas em `/pedir` (Cardápio simples e Experiência 3D):** exceção documentada ao veto de duas escolhas lado a lado, diferenciando visualmente a hierarquia entre o pedido rápido e a experiência interativa 3D sem que pareçam dois cartões gêmeos genéricos. (16/11/2026)
- **Carimbo "com capricho" inclinado (`-14deg`) na Comanda:** representa um carimbo físico no papel da comanda; textos de interface continuam sempre retos. (14–16/11/2026, `ai-memory`)
