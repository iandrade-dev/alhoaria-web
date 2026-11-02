# Alhoaria — Site Oficial & Cardápio Interativo 3D

> **Lanches no Pão de Alho!** — Projeto para a **Alhoaria** (@alhoaria), Palhoça e São José (SC).
> Desenvolvido por **Igor Andrade (@iandradedev)**.

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
