# Alhoaria — Site Oficial & Cardápio Interativo 3D

> **Lanches no Pão de Alho!** — Projeto para a **Alhoaria** (@alhoaria), Palhoça e São José (SC).
> Desenvolvido por **Igor Andrade (@iandradedev)**.

---

## Pesquisa e handoff (Grok Bot / Insta Dev)

O levantamento de 01–02/11/2026 está em [`docs/grokbot/GROKBOT-LEVANTAMENTO.md`](docs/grokbot/GROKBOT-LEVANTAMENTO.md). Dali sai o restante da pasta:

- **Pesquisa IG + Anota AI** — cardápio, unidades e tom visual (cozinha escura, maçarico, queijo).
- **Brief Blender/site** — brand kit, menu, escopo e lista de GLBs em [`ALHOARIA-BRIEF-GPT-BLENDER.md`](docs/grokbot/ALHOARIA-BRIEF-GPT-BLENDER.md).
- **Montador 3D** — mão do chef coloca e tira ingredientes numa cozinha realista; o pedido fecha no WhatsApp. Refs em [`REFS-3D.md`](docs/grokbot/REFS-3D.md) (Wawa Eats, pizza makers).
- **Time Grok Bot Alhoaria** — Orquestra, Pesquisa, Modelo, Física, Front e QA.
- **Agents OpenCode** — `alhoaria-orquestra` e `@alhoaria-pesquisa`, `@alhoaria-modelo`, `@alhoaria-fisica`, `@alhoaria-front`, `@alhoaria-qa`. Plano em [`PLANO-V2.md`](docs/grokbot/PLANO-V2.md); assets e licenças em [`ASSET-LIST-V2.md`](docs/grokbot/ASSET-LIST-V2.md) e [`FONTES-ASSETS-P0.md`](docs/grokbot/FONTES-ASSETS-P0.md).

Preços e contatos raspados continuam marcados **VERIFICAR COM O CLIENTE**. Não publicar sem ok explícito.

---

## 🚀 Tecnologias

* **Next.js 15 (App Router)** + **React 19** + **TypeScript**
* **Tailwind CSS** com os tokens oficiais da marca (`--carvao`, `--osso`, `--ouro`, `--queijo`, `--macarico`, `--madeira`)
* **Three.js** para renderização e interação 3D em tempo real do Pão de Alho / Hambúrguer artesanal
* **Zustand** com persistência em `localStorage` para a Sacola / Carrinho
* **Framer Motion** & **Lucide React** para animações e ícones
* **Motion Designer Skill**: animações fluidas, efeitos de maçarico e anti-tells rigorosos (sem visual genérico de IA)

---

## 🍔 Funcionalidades

1. **Hero 3D Interativo:** Pão de alho / hambúrguer com visualização 360°, fumaça de vapor procedural, queijo gratinado e brilho de maçarico.
2. **Cardápio Interativo Completo:**
   * **Sanduíches no Pão de Alho:** A Costela! (6h), Frango!, Mr. Alcatra!, Brócolis & Queijo!, Pulled Pork!, Dogalho.
   * **Combos:** Clássico + Bebida, Trio Alhoaria, Trio Casal, Trio Dogalho, Duplo Pizzalho + Pureza 1,5L.
   * **Burgers:** Clássico, Salada, Onio.
   * **Pizzalho:** 4 pedaços, 6 pedaços, 8 pedaços e Calabresa.
   * **Porções:** Dadinho de tapioca, batata rústica, batata frita, onion rings, isca de frango.
   * **Mac Cheese Alhoaria (Monte o Seu):** Configurador interativo de massa (Penne/Espaguete), molhos (4 queijos, cheddar defumado, alho & azeite) e proteínas adicionais.
   * **Chopp Lohn:** Caneca trincando, growler de 1L e cervejas artesanais.
   * **Bebidas:** Guaraná Pureza catarinense, refrigerantes e soda italiana.
3. **Drawer de Detalhes:** Lista "Vai no Lanche", observações e seletor de quantidades.
4. **Checkout Direto para WhatsApp:** Formatação automática do pedido para a unidade selecionada (Pedra Branca ou Kobrasol) + fallback para Anota AI.
5. **Horário de Atendimento Dinâmico:** Cálculo em tempo real do status "Aberto agora / Abre às 18:30" baseado no fuso horário de Santa Catarina.

---

## 🛠️ Como Rodar Localmente

```bash
# Entrar no diretório do projeto
cd alhoaria-web

# Instalar as dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🌐 Como Subir na Vercel

### Opção 1: Via Vercel CLI
```bash
# Na pasta do projeto:
npx vercel
```

### Opção 2: Via GitHub
1. Crie um repositório no seu GitHub (ex: `alhoaria-web`).
2. Adicione o remote e envie o código:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/alhoaria-web.git
   git branch -M main
   git push -u origin main
   ```
3. Acesse [vercel.com](https://vercel.com), clique em **"Add New Project"**, selecione o repositório e clique em **Deploy**.

---

## 📝 Atualização de Preços e Cardápio

Todos os dados de produtos, preços, descrições, fotos e unidades estão centralizados em um único arquivo:
`src/data/menu.json`.
Para alterar qualquer valor ou adicionar um item, basta editar o JSON sem precisar mexer em código de interface.
