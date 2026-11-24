"use client";

import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCatalogo } from "@/components/CatalogoProvider";
import { brl, type Bebida, type CardapioAlhoaria, type GrupoOpcao, type Pedido, type PorcaoId, type SaborLata } from "@/components/bancada-proto/cardapio";
import type { ProdutoPublicado } from "@/lib/publicacao-alhoaria";
import type { ConteudoSacola } from "@/lib/sacola";
import { useSacola } from "./SacolaProvider";
import { nomeDoConteudo, usePainelModal } from "./Sacola";
import styles from "./pedido.module.css";

type LancheId = Pedido["lanche"];
export type Edicao = { id?: string; quantidade: number; conteudo: ConteudoSacola };
const AcoesContext = createContext<{ adicionarPadrao: (id: LancheId) => void; personalizar: (id: LancheId) => void; pronta: boolean } | null>(null);
export const normalizarBusca = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const valorBebida = (b: Bebida | null) => b ? `${b.id}${"sabor" in b ? `:${b.sabor}` : ""}` : "";
const bebidaDoValor = (lista: readonly Bebida[], valor: string): Bebida | null => lista.find((b) => valorBebida(b) === valor) ?? null;
const GRUPOS: Record<GrupoOpcao, string> = { pao: "Pão", pasta: "Pasta de alho", creme: "Creme de queijo", queijo: "Queijo gratinado" };

export function AcoesLanche({ id }: { id: LancheId }) {
  const acoes = useContext(AcoesContext);
  const nome = useCatalogo()?.lanches.find((p) => p.id === id)?.nome;
  return <div className={styles.actions}><button type="button" className={styles.primary} disabled={!acoes?.pronta || !nome} onClick={() => acoes?.adicionarPadrao(id)} aria-label={nome ? `Adicionar ${nome} padrão à sacola` : undefined}>Adicionar padrão</button><button type="button" className={styles.secondary} disabled={!acoes?.pronta || !nome} onClick={() => acoes?.personalizar(id)}>Personalizar</button></div>;
}

export default function CardapioRapido({ children, consulta = "" }: { children: ReactNode; consulta?: string }) {
  const cardapio = useCatalogo();
  const sacola = useSacola();
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [mensagem, setMensagem] = useState("");
  const processada = useRef<string | null>(null);
  useEffect(() => {
    if (!cardapio || !sacola.pronta || processada.current === consulta) return;
    processada.current = consulta;
    const q = new URLSearchParams(consulta); const id = q.get("editar");
    if (id) {
      const item = sacola.itens.find((i) => i.id === id);
      if (item) setEdicao({ id: item.id, quantidade: item.quantidade, conteudo: JSON.parse(JSON.stringify(item.conteudo)) as ConteudoSacola });
      else setMensagem("Este item não está mais na sacola. Escolha outro no cardápio.");
      return;
    }
    const produto = cardapio.lanches.find((p) => p.id === q.get("lanche"));
    if (produto) setEdicao({ quantidade: 1, conteudo: { tipo: "lanche", pedido: cardapio.pedidoDaURL(q, produto.id) } });
  }, [cardapio, consulta, sacola.pronta, sacola.itens]);
  if (!cardapio) return <p className={styles.notice} role="status">O cardápio publicado está indisponível. Tente novamente em instantes.</p>;
  const { bebidas, nomeBebida, precoBebidaAvulsa, ORDEM_PORCOES, PORCOES } = cardapio;
  function fechar() { setEdicao(null); if (consulta) router.replace("/cardapio", { scroll: false }); }
  const adicionar = (conteudo: ConteudoSacola) => {
    if (sacola.adicionar(conteudo)) setMensagem(`${nomeDoConteudo(conteudo, cardapio)} na sacola.`);
    else setMensagem("Não foi possível adicionar. Confira as escolhas e tente novamente.");
  };
  const termo = normalizarBusca(busca.trim());
  const cards = Children.toArray(children).filter((child) => !termo || isValidElement<{ "data-busca": string }>(child) && normalizarBusca(child.props["data-busca"] ?? "").includes(termo));
  const bebidasVisiveis = bebidas.filter((b) => normalizarBusca(nomeBebida(b, true)).includes(termo));
  const porcoesVisiveis = ORDEM_PORCOES.filter((p) => normalizarBusca(`${PORCOES[p].nome} ${PORCOES[p].molho}`).includes(termo));
  const produtosVisiveis = cardapio.produtos.filter((p) => normalizarBusca(`${p.name} ${p.description} ${p.ingredients.join(" ")}`).includes(termo));
  const categorias = [["todos", "Tudo"], ["lanches", "Lanches"], ["bebidas", "Bebidas"], ["porcoes", "Porções"]];
  if (cardapio.produtos.length) categorias.push(["produtos", "Outros produtos"]);
  return <AcoesContext.Provider value={{ pronta: sacola.pronta, adicionarPadrao: (id) => adicionar({ tipo: "lanche", pedido: cardapio.pedidoPadrao(id) }), personalizar: (id) => setEdicao({ quantidade: 1, conteudo: { tipo: "lanche", pedido: cardapio.pedidoPadrao(id) } }) }}>
    <div className={styles.toolbar}><label className={styles.visuallyHidden} htmlFor="busca-cardapio">Buscar no cardápio</label><input id="busca-cardapio" className={styles.search} type="search" placeholder="Buscar lanche, bebida ou porção" value={busca} onChange={(e) => setBusca(e.target.value)} /><button type="button" className={`${styles.primary} ${styles.toolbarBag}`} disabled={!sacola.pronta} onClick={sacola.abrirSacola}>{sacola.pronta ? `Ver sacola · ${brl(sacola.total)}` : "Preparando sacola…"}</button></div>
    <div className={styles.categories} aria-label="Categorias">{categorias.map(([id, nome]) => <button key={id} type="button" className={styles.chip} aria-pressed={categoria === id} onClick={() => setCategoria(id)}>{nome}</button>)}</div>
    {sacola.aviso && <p className={styles.notice}>{sacola.aviso}</p>}
    {(categoria === "todos" || categoria === "lanches") && <section aria-label="Lanches"><h2 className={styles.sectionTitle}>Lanches</h2><p className={`${styles.smallNote} ${styles.menuNote}`}>Padrão da casa, sem extras. Ou personalize.</p><div className={styles.grid}>{cards}</div>{cards.length === 0 && <p className={styles.empty}>Nenhum lanche encontrado.</p>}</section>}
    {(categoria === "todos" || categoria === "bebidas") && <section aria-label="Bebidas avulsas"><h2 className={styles.sectionTitle}>Bebidas avulsas</h2><p className={styles.smallNote}>Cada bebida entra como um item independente na sacola.</p><div className={styles.grid}>{bebidasVisiveis.map((b) => <article className={`${styles.card} ${styles.simpleCard}`} key={valorBebida(b)}><div className={styles.cardBody}><h3>{nomeBebida(b, true)}</h3><p className={styles.price}>{brl(precoBebidaAvulsa(b))}</p><button type="button" className={styles.primary} disabled={!sacola.pronta} onClick={() => adicionar({ tipo: "bebida", bebida: b })}>Adicionar bebida</button></div></article>)}</div>{bebidasVisiveis.length === 0 && <p className={styles.empty}>Nenhuma bebida encontrada.</p>}</section>}
    {(categoria === "todos" || categoria === "porcoes") && <section aria-label="Porções avulsas"><h2 className={styles.sectionTitle}>Porções avulsas</h2><div className={styles.grid}>{porcoesVisiveis.map((id) => <article className={`${styles.card} ${styles.simpleCard}`} key={id}><div className={styles.cardBody}><h3>{PORCOES[id].nome}</h3><p className={styles.description}>{PORCOES[id].molho}</p><p className={styles.price}>A partir de {brl(PORCOES[id].preco)}</p><button type="button" className={styles.primary} disabled={!sacola.pronta} onClick={() => adicionar({ tipo: "porcao", porcao: id })}>Adicionar porção</button></div></article>)}</div>{porcoesVisiveis.length === 0 && <p className={styles.empty}>Nenhuma porção encontrada.</p>}</section>}
    {cardapio.produtos.length > 0 && (categoria === "todos" || categoria === "produtos") && <section aria-label="Outros produtos"><h2 className={styles.sectionTitle}>Outros produtos</h2><div className={styles.grid}>{produtosVisiveis.map((produto) => <ProdutoCard key={produto.id} cardapio={cardapio} produto={produto} pronta={sacola.pronta} adicionar={adicionar} personalizar={(conteudo) => setEdicao({ quantidade: 1, conteudo })} />)}</div>{produtosVisiveis.length === 0 && <p className={styles.empty}>Nenhum produto encontrado.</p>}</section>}
    <p className={styles.notice}>Entrega e disponibilidade são confirmadas na finalização.</p>
    {mensagem && <div className={styles.success} role="status"><span>{mensagem}</span><button type="button" className={styles.textButton} onClick={() => { setMensagem(""); sacola.abrirSacola(); }}>Ver sacola</button><button type="button" className={styles.textButton} onClick={() => setMensagem("")} aria-label="Fechar aviso">×</button></div>}
    {edicao && <Editor key={edicao.id ?? "novo"} cardapio={cardapio} inicial={edicao} aoFechar={fechar} aoSalvar={(conteudo, quantidade) => {
      const ok = edicao.id ? sacola.atualizar(edicao.id, conteudo, quantidade) : !!sacola.adicionar(conteudo, quantidade);
      if (ok) { setMensagem(edicao.id ? "Item atualizado na sacola." : `${nomeDoConteudo(conteudo, cardapio)} na sacola.`); fechar(); }
      return ok;
    }} />}
  </AcoesContext.Provider>;
}

function ProdutoCard({ cardapio, produto, pronta, adicionar, personalizar }: { cardapio: CardapioAlhoaria; produto: ProdutoPublicado; pronta: boolean; adicionar: (c: ConteudoSacola) => void; personalizar: (c: ConteudoSacola) => void }) {
  const padrao = cardapio.produtoPadrao(produto);
  const preco = padrao ? cardapio.precoProduto(produto, padrao) : null;
  const foto = produto.photos[0]?.url;
  return <article className={`${styles.card} ${foto ? "" : styles.simpleCard}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {foto && <img src={foto} alt={produto.name} width={600} height={400} loading="lazy" className={styles.photo} />}
    <div className={styles.cardBody}><h3>{produto.name}</h3><p className={styles.description}>{produto.description}</p>
      <p className={styles.price}>{preco == null ? "Indisponível" : brl(preco)}</p>
      {padrao && preco != null && <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!pronta} onClick={() => adicionar(padrao)} aria-label={`Adicionar ${produto.name} à sacola`}>Adicionar</button>
        {(produto.variants.length > 0 || produto.optionGroups.length > 0) && <button type="button" className={styles.secondary} disabled={!pronta} onClick={() => personalizar(padrao)} aria-label={`Personalizar ${produto.name}`}>Personalizar</button>}
      </div>}
    </div>
  </article>;
}

export function Quantidade({ valor, min = 0, max = 99, aoMudar, nome = "Quantidade" }: { valor: number; min?: number; max?: number; aoMudar: (n: number) => void; nome?: string }) {
  return <div className={styles.stepper} role="group" aria-label={nome}><button type="button" disabled={valor <= min} onClick={() => aoMudar(valor - 1)} aria-label={`Diminuir ${nome.toLowerCase()}`}>−</button><output>{valor}</output><button type="button" disabled={valor >= max} onClick={() => aoMudar(valor + 1)} aria-label={`Aumentar ${nome.toLowerCase()}`}>+</button></div>;
}

/** Também usado pelo modo garçom, com `destino` próprio (a comanda da mesa em vez da sacola). */
export function Editor({ cardapio, inicial, aoFechar, aoSalvar, destino, maxQuantidade = 99 }: { cardapio: CardapioAlhoaria; inicial: Edicao; aoFechar: () => void; aoSalvar: (conteudo: ConteudoSacola, quantidade: number) => boolean; destino?: { adicionar: string; aviso: string; erro: string }; maxQuantidade?: number }) {
  const { ADICIONAIS, OPCOES, ORDEM_ADICIONAIS, ORDEM_GRUPOS, ORDEM_PORCOES, ORDEM_SEPARADOS, PORCOES, SABORES_LATA, SEM_OPCAO, SEPARADOS, bebidas, bebidasJunto, nomeBebida, precoBebida, precoBebidaAvulsa, precoDoTrio, lataContaNoTrio, saborDaLataDoCombo, totalDoPedido, trioDe } = cardapio;
  const [conteudo, setConteudo] = useState(inicial.conteudo);
  const [quantidade, setQuantidade] = useState(inicial.quantidade);
  const [erro, setErro] = useState("");
  const painel = usePainelModal(true, aoFechar);
  const pedido = conteudo.tipo === "lanche" ? conteudo.pedido : null;
  const mudarPedido = (f: (p: Pedido) => Pedido) => setConteudo((c) => c.tipo === "lanche" ? { ...c, pedido: f(c.pedido) } : c);
  const trio = pedido ? trioDe(pedido.lanche) : null;
  const grupos = ORDEM_GRUPOS.filter((grupo) => OPCOES[grupo].length > 0);
  const produto = conteudo.tipo === "produto" ? cardapio.produtos.find((p) => p.id === conteudo.id) : null;
  const preco = pedido ? totalDoPedido(pedido) : conteudo.tipo === "bebida" ? precoBebidaAvulsa(conteudo.bebida) : conteudo.tipo === "porcao" ? PORCOES[conteudo.porcao].preco : produto && conteudo.tipo === "produto" ? cardapio.precoProduto(produto, conteudo) : null;
  function salvar() {
    if (pedido?.opcoes) for (const grupo of grupos) if (!pedido.opcoes[grupo]) {
      setErro(`Escolha ${GRUPOS[grupo].toLowerCase()} antes de adicionar.`); painel.current?.querySelector<HTMLSelectElement>(`#editor-${grupo}`)?.focus(); return;
    }
    if (pedido?.combo && !saborDaLataDoCombo(pedido)) { setErro("Escolha o sabor da lata incluída no combo."); painel.current?.querySelector<HTMLSelectElement>("#editor-lata-combo")?.focus(); return; }
    if (conteudo.tipo === "produto" && preco == null) { setErro(produto ? "Confira as opções e o tamanho deste produto." : "Este produto não está disponível no cardápio publicado."); return; }
    if (!aoSalvar(conteudo, quantidade)) setErro(destino?.erro ?? "Não foi possível salvar este item. Ele pode ter sido removido; confira a sacola.");
  }
  return <div className={styles.overlay}><div className={styles.panel} ref={painel} role="dialog" aria-modal="true" aria-labelledby="titulo-editor" aria-describedby="aviso-rascunho" tabIndex={-1}>
    <header className={styles.panelHeader}><div><h2 id="titulo-editor">{inicial.id ? "Editar" : "Personalizar"} {nomeDoConteudo(conteudo, cardapio)}</h2><p className={styles.smallNote} id="aviso-rascunho">{destino?.aviso ?? "As alterações só entram na sacola ao salvar. Fechar descarta este rascunho."}</p></div><button type="button" className={styles.close} onClick={aoFechar} aria-label="Cancelar edição">×</button></header>
    <div className={styles.panelBody}>
      {pedido && <>
        {pedido.opcoes && grupos.length > 0 && <fieldset className={styles.fieldset}><legend className={styles.legend}>Ingredientes do lanche</legend><p className={styles.smallNote}>As escolhas abaixo não alteram o preço base.</p>{grupos.map((grupo) => <label className={styles.field} key={grupo} htmlFor={`editor-${grupo}`}>{GRUPOS[grupo]}<select id={`editor-${grupo}`} className={styles.select} value={pedido.opcoes?.[grupo] ?? ""} onChange={(e) => { const valor = e.target.value; mudarPedido((p) => ({ ...p, opcoes: { ...p.opcoes!, [grupo]: valor || null } })); setErro(""); }}><option value="">Escolha uma opção</option>{OPCOES[grupo].map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}{grupo !== "pao" && <option value="sem">{SEM_OPCAO[grupo].nome}</option>}</select></label>)}</fieldset>}
        {ORDEM_ADICIONAIS.length > 0 && <fieldset className={styles.fieldset}><legend className={styles.legend}>Adicionais no lanche</legend>{ORDEM_ADICIONAIS.map((id) => <div key={id} className={styles.optionRow}><div>{ADICIONAIS[id].nome}<small>+ {brl(ADICIONAIS[id].preco)} por unidade</small></div><Quantidade valor={pedido.adicionais[id] ?? 0} max={ADICIONAIS[id].max} nome={ADICIONAIS[id].nome} aoMudar={(n) => mudarPedido((p) => ({ ...p, adicionais: { ...p.adicionais, [id]: n } }))} /></div>)}</fieldset>}
        {ORDEM_SEPARADOS.length > 0 && <fieldset className={styles.fieldset}><legend className={styles.legend}>Potinhos separados</legend>{ORDEM_SEPARADOS.map((id) => <div key={id} className={styles.optionRow}><div>{SEPARADOS[id].nome}<small>+ {brl(SEPARADOS[id].preco)} por unidade</small></div><Quantidade valor={pedido.separados[id] ?? 0} max={SEPARADOS[id].max} nome={SEPARADOS[id].nome} aoMudar={(n) => mudarPedido((p) => ({ ...p, separados: { ...p.separados, [id]: n } }))} /></div>)}</fieldset>}
        {trio && <fieldset className={styles.fieldset}><legend className={styles.legend}>Quer um combo?</legend><label className={styles.check}><input type="checkbox" checked={pedido.combo} onChange={(e) => { const combo = e.target.checked; mudarPedido((p) => ({ ...p, combo })); }} /><span>{trio.nome} · {brl(precoDoTrio(trio, pedido.lanche))}<span className={styles.smallNote}> — troca o lanche avulso por lanche + {trio.batata} + 1 refri lata. Adicionais são cobrados à parte.</span></span></label>{pedido.combo && !lataContaNoTrio(pedido) && <label className={styles.field} htmlFor="editor-lata-combo">Sabor da lata incluída<select id="editor-lata-combo" className={styles.select} value={pedido.lataCombo ?? ""} onChange={(e) => { const sabor = e.target.value as SaborLata; mudarPedido((p) => ({ ...p, lataCombo: sabor || null })); setErro(""); }}><option value="">Escolha o sabor</option>{trio.latas.map((s) => <option key={s} value={s}>{SABORES_LATA[s].nome}</option>)}</select></label>}</fieldset>}
        {bebidasJunto.length > 0 && <label className={styles.field}>Bebida junto do lanche<select className={styles.select} value={valorBebida(pedido.bebida)} onChange={(e) => { const bebida = bebidaDoValor(bebidasJunto, e.target.value); mudarPedido((p) => ({ ...p, bebida })); }}><option value="">Sem bebida extra</option>{bebidasJunto.map((b) => <option key={valorBebida(b)} value={valorBebida(b)}>{nomeBebida(b)} · {pedido.combo && b.id === "lata" && trio?.latas.includes(b.sabor) ? "incluída no combo" : `+ ${brl(precoBebida(b))}`}</option>)}</select><span className={styles.smallNote}>{pedido.combo ? "Uma lata elegível pode entrar no combo. Qualquer outra bebida é cobrada à parte." : "A bebida será incluída na mesma linha do lanche."}</span></label>}
        {ORDEM_PORCOES.length > 0 && <label className={styles.field}>Porção junto do lanche<select className={styles.select} value={pedido.porcao ?? ""} onChange={(e) => { const porcao = e.target.value as PorcaoId; mudarPedido((p) => ({ ...p, porcao: porcao || null })); }}><option value="">Sem porção extra</option>{ORDEM_PORCOES.map((p) => <option key={p} value={p}>{PORCOES[p].nome} · a partir de + {brl(PORCOES[p].preco)}</option>)}</select>{pedido.combo && <span className={styles.smallNote}>Esta porção é extra: a batata do combo continua incluída.</span>}</label>}
      </>}
      {conteudo.tipo === "bebida" && <label className={styles.field}>Bebida avulsa<select className={styles.select} value={valorBebida(conteudo.bebida)} onChange={(e) => { const bebida = bebidaDoValor(bebidas, e.target.value); if (bebida) setConteudo({ tipo: "bebida", bebida }); }}>{bebidas.map((b) => <option key={valorBebida(b)} value={valorBebida(b)}>{nomeBebida(b, true)} · {brl(precoBebidaAvulsa(b))}</option>)}</select></label>}
      {conteudo.tipo === "porcao" && <label className={styles.field}>Porção avulsa<select className={styles.select} value={conteudo.porcao} onChange={(e) => setConteudo({ tipo: "porcao", porcao: e.target.value as PorcaoId })}>{ORDEM_PORCOES.map((p) => <option key={p} value={p}>{PORCOES[p].nome} · a partir de {brl(PORCOES[p].preco)}</option>)}</select></label>}
      {produto && conteudo.tipo === "produto" && <OpcoesProduto produto={produto} conteudo={conteudo} aoMudar={(c) => { setConteudo(c); setErro(""); }} />}
      <div className={styles.optionRow}><div><strong>Quantidade</strong><p className={styles.smallNote}>Multiplica este item com todos os adicionais, bebida e porção selecionados.</p></div><Quantidade valor={quantidade} min={1} max={maxQuantidade} nome="Quantidade do item" aoMudar={setQuantidade} /></div>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
    </div><footer className={styles.panelFooter}><div><p className={styles.smallNote}>Total · {quantidade} {quantidade === 1 ? "unidade" : "unidades"}</p><strong className={styles.price}>{preco == null ? "Confira as opções" : brl(preco * quantidade)}</strong></div><button type="button" className={styles.primary} onClick={salvar}>{inicial.id ? "Salvar alterações" : destino?.adicionar ?? "Adicionar à sacola"}</button><button type="button" className={styles.textButton} onClick={aoFechar}>Cancelar</button></footer>
  </div></div>;
}

type ConteudoProduto = Extract<ConteudoSacola, { tipo: "produto" }>;

function OpcoesProduto({ produto, conteudo, aoMudar }: { produto: ProdutoPublicado; conteudo: ConteudoProduto; aoMudar: (c: ConteudoProduto) => void }) {
  return <>
    {produto.variants.length > 0 && <label className={styles.field}>Variação<select className={styles.select} value={conteudo.variante ?? ""} onChange={(e) => aoMudar({ ...conteudo, variante: e.target.value || null })}>
      <option value="">Escolha uma variação</option>{produto.variants.filter((v) => v.available).map((v) => <option key={v.id} value={v.id}>{v.label} · {brl(v.priceCents)}</option>)}
    </select></label>}
    {produto.optionGroups.map((grupo) => {
      const disponiveis = grupo.options.filter((opcao) => opcao.available);
      if (!disponiveis.length) return null;
      const ids = new Set(disponiveis.map((o) => o.id));
      const selecionadas = conteudo.opcoes.filter((id) => ids.has(id));
      return <fieldset className={styles.fieldset} key={grupo.id}><legend className={styles.legend}>{grupo.name}</legend>
        <p className={styles.smallNote}>{grupo.min === grupo.max ? `Escolha ${grupo.min}.` : `Escolha de ${grupo.min} a ${grupo.max}.`}</p>
        {disponiveis.map((opcao) => {
          const marcada = selecionadas.includes(opcao.id);
          return <label className={styles.check} key={opcao.id}>
            <input type="checkbox" checked={marcada} disabled={!marcada && grupo.max > 1 && selecionadas.length >= grupo.max} onChange={() => {
              const opcoes = marcada ? conteudo.opcoes.filter((id) => id !== opcao.id) : [...conteudo.opcoes.filter((id) => grupo.max !== 1 || !ids.has(id)), opcao.id];
              aoMudar({ ...conteudo, opcoes });
            }} />
            <span>{opcao.name}{opcao.priceCents > 0 && ` · + ${brl(opcao.priceCents)}`}</span>
          </label>;
        })}
      </fieldset>;
    })}
  </>;
}
