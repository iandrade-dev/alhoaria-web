# Refs 3D food / montagem (Alhoaria)

Coletado 02/11/2026. Usar como inspiração técnica — não copiar assets proprietários.

## Configuradores sanduíche / burger (obrigatório estudar)

1. **Wawa Sensei — 3D Sandwich Configurator (R3F)**  
   - Tut: https://wawasensei.dev/tuto/3d-food-delivery-app-with-react-native-and-react-three-fiber  
   - Code: https://github.com/wass08/r3f-wawa-eats  
   - Modelo Sketchfab sandwich assembly (crédito no repo)  
   - Padrão: Zustand + React Spring + pilha de ingredientes animada — **base do nosso builder**

2. **Build a Burger** — https://build-burger.vercel.app/  
   - Preview 3D em tempo real ao clicar ingredientes (ordem top→bottom)

3. **how-2-sandwich** — https://github.com/eboysen/how-2-sandwich  
   - Three.js + GLBs de ingredientes; mostra o custo de modelar tudo

4. **AlanCasal sandwich scene (R3F)** — https://github.com/AlanCasal/threejs-fiber-things  
   - Cena Sandwich com transições + orbit touch

5. **sammy** (histórico) — https://github.com/insanj/sammy  
   - Desmontar sanduíche 3D (ideia de “tirar” ingrediente)

## Pizza / colocação à mão

6. **My Royal Chef — 3D Pizza Maker** — https://myroyalchef.com/tools/pizza-maker  
   - Arrasta topping, undo, mobile-first, gera pedido texto → achar pizzaria (**espelho do nosso WhatsApp**)

7. **Luigi’s Pizza House** — https://wavedash.com/games/luigi-s-pizza-house  
   - Cada topping é peça 3D colocada à mão; undo/correct; atmosfera de cozinha cozy (Babylon.js)

8. **Dotimo pizza WebGL** — https://www.dotimo.ru/portfolio/interaktivnyj-3d-konfigurator-pitstsy  
   - Case comercial de configurador leve

## Física / soft / kits

9. **Ten Minute Physics soft bodies** — https://github.com/matthias-research/pages (demo softBodies) — ref de squash; **não** default mobile  
10. **Ammo.js soft-body + Three** — https://github.com/philsawicki/soft-body-simulation  
11. **Tridsy parametric burger** — https://tridsy.com/assets/food-burger — knobs (queijo derrete, camadas)  
12. **Kenney Food Kit + Three** — https://nrsharip.github.io/threejs-food-kit/ — kit low-poly (só protótipo; Alhoaria quer food porn)

## Direção pra Alhoaria

| Camada | Escolha v1 |
|--------|------------|
| Stack | R3F + Drei + React Spring (+ Rapier só se empilhar/colisões pedirem) |
| Add/remove | Animação de **mão de chef** (GLB rig) + spring na pilha — sensação de carinho > simulação total |
| Queijo | Blendshape / morph ou shader melt leve — soft-body só se sobrar budget |
| Cena | Cozinha escura (carvão/madeira/maçariço), tábua, luz quente volume |
| Checkout | Montagem → resumo → WhatsApp com texto do pedido |
| Perf | Poster WebP → GLB Draco deferred; fallback sem WebGL |

## Gap vs MVP atual (`alhoaria-ingredientes.glb`)

Brief pedia GLBs **por item** + mão + cena. Kit único de ingredientes = ok pra MVP; v2 separa hero Costela/Dogalho/Pizzalho/Mac + mão + tabua/cozinha.
