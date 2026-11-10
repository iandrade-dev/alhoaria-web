"use client";

import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ADICIONAIS, AVISO, OPCOES, OPCOES_PADRAO, ORDEM_ADICIONAIS, ORDEM_GRUPOS, ORDEM_PORCOES, ORDEM_SABORES_LATA, ORDEM_SABORES_SODA, ORDEM_SEPARADOS, PORCOES, SABORES_LATA, SEM_OPCAO, SEPARADOS,
  brl, novoPedido, nomeBebida, precoBebida, saborDaLataDoCombo, totalDoPedido, trioDe,
  type Bebida, type GrupoOpcao, type Pedido, type PorcaoId, type SaborLata,
} from "@/components/bancada-proto/cardapio";
import { CATALOGO, CATALOGO_POR_ID } from "@/data/catalogo";
import { pedidoDaURL } from "@/lib/pedido-url";
import type { ConteudoSacola } from "@/lib/sacola";
import { useSacola } from "./SacolaProvider";
import { nomeDoConteudo, usePainelModal } from "./Sacola";
import styles from "./pedido.module.css";

type LancheId = Pedido["lanche"];
type Edicao = { id?: string; quantidade: number; conteudo: ConteudoSacola };
const AcoesContext = createContext<{ adicionarPadrao: (id: LancheId) => void; personalizar: (id: LancheId) => void; pronta: boolean } | null>(null);
const padrao = (id: LancheId): Pedido => ({ ...novoPedido(id), opcoes: id === "dogalho" ? null : { ...OPCOES_PADRAO } });
const normalizarBusca = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const bebidas: Bebida[] = [...ORDEM_SABORES_LATA.map((sabor): Bebida => ({ id: "lata", sabor })), { id: "chopp" }, ...ORDEM_SABORES_SODA.map((sabor): Bebida => ({ id: "soda", sabor }))];
const valorBebida = (b: Bebida | null) => b ? `${b.id}${"sabor" in b ? `:${b.sabor}` : ""}` : "";
const bebidaDoValor = (valor: string): Bebida | null => bebidas.find((b) => valorBebida(b) === valor) ?? null;
const GRUPOS: Record<GrupoOpcao, string> = { pao: "Pão", pasta: "Pasta de alho", creme: "Creme de queijo", queijo: "Queijo gratinado" };

export function AcoesLanche({ id }: { id: LancheId }) {
  const acoes = useContext(AcoesContext);
  return <div className={styles.actions}><button type="button" className={styles.primary} disabled={!acoes?.pronta} onClick={() => acoes?.adicionarPadrao(id)} aria-label={`Adicionar ${CATALOGO_POR_ID[id].nome} padrão à sacola`}>Adicionar padrão</button><button type="button" className={styles.secondary} disabled={!acoes?.pronta} onClick={() => acoes?.personalizar(id)}>Personalizar</button></div>;
}

export default function CardapioRapido({ children, consulta = "" }: { children: ReactNode; consulta?: string }) {
  const sacola = useSacola();
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [mensagem, setMensagem] = useState("");
  const processada = useRef<string | null>(null);
  useEffect(() => {
    if (!sacola.pronta || processada.current === consulta) return;
    processada.current = consulta;
    const q = new URLSearchParams(consulta); const id = q.get("editar");
    if (id) {
      const item = sacola.itens.find((i) => i.id === id);
      if (item) setEdicao({ id: item.id, quantidade: item.quantidade, conteudo: JSON.parse(JSON.stringify(item.conteudo)) as ConteudoSacola });
      else setMensagem("Este item não está mais na sacola. Escolha outro no cardápio.");
      return;
    }
    const produto = CATALOGO.find((p) => p.id === q.get("lanche"));
    if (produto) setEdicao({ quantidade: 1, conteudo: { tipo: "lanche", pedido: pedidoDaURL(q, produto.id) } });
  }, [consulta, sacola.pronta, sacola.itens]);
  function fechar() { setEdicao(null); if (consulta) router.replace("/cardapio", { scroll: false }); }
  function adicionar(conteudo: ConteudoSacola) {
    if (sacola.adicionar(conteudo)) setMensagem(`${nomeDoConteudo(conteudo)} na sacola.`);
    else setMensagem("Não foi possível adicionar. Confira as escolhas e tente novamente.");
  }
  const termo = normalizarBusca(busca.trim());
  const cards = Children.toArray(children).filter((child) => !termo || isValidElement<{ "data-busca": string }>(child) && normalizarBusca(child.props["data-busca"] ?? "").includes(termo));
  const bebidasVisiveis = bebidas.filter((b) => normalizarBusca(nomeBebida(b)).includes(termo));
  const porcoesVisiveis = ORDEM_PORCOES.filter((p) => normalizarBusca(`${PORCOES[p].nome} ${PORCOES[p].molho}`).includes(termo));
  return <AcoesContext.Provider value={{ pronta: sacola.pronta, adicionarPadrao: (id) => adicionar({ tipo: "lanche", pedido: padrao(id) }), personalizar: (id) => setEdicao({ quantidade: 1, conteudo: { tipo: "lanche", pedido: padrao(id) } }) }}>
    <div className={styles.toolbar}><label className={styles.visuallyHidden} htmlFor="busca-cardapio">Buscar no cardápio</label><input id="busca-cardapio" className={styles.search} type="search" placeholder="Buscar lanche, bebida ou porção" value={busca} onChange={(e) => setBusca(e.target.value)} /><button type="button" className={`${styles.primary} ${styles.toolbarBag}`} disabled={!sacola.pronta} onClick={sacola.abrirSacola}>{sacola.pronta ? `Ver sacola · ${brl(sacola.total)}` : "Preparando sacola…"}</button></div>
    <div className={styles.categories} aria-label="Categorias">{[["todos", "Tudo"], ["lanches", "Lanches"], ["bebidas", "Bebidas"], ["porcoes", "Porções"]].map(([id, nome]) => <button key={id} type="button" className={styles.chip} aria-pressed={categoria === id} onClick={() => setCategoria(id)}>{nome}</button>)}</div>
    {sacola.aviso && <p className={styles.notice}>{sacola.aviso}</p>}
    {(categoria === "todos" || categoria === "lanches") && <section aria-label="Lanches"><h2 className={styles.sectionTitle}>Lanches</h2><p className={`${styles.smallNote} ${styles.menuNote}`}>Padrão da casa, sem extras. Ou personalize.</p><div className={styles.grid}>{cards}</div>{cards.length === 0 && <p className={styles.empty}>Nenhum lanche encontrado.</p>}</section>}
    {(categoria === "todos" || categoria === "bebidas") && <section aria-label="Bebidas avulsas"><h2 className={styles.sectionTitle}>Bebidas avulsas</h2><p className={styles.smallNote}>Cada bebida entra como um item independente na sacola.</p><div className={styles.grid}>{bebidasVisiveis.map((b) => <article className={`${styles.card} ${styles.simpleCard}`} key={valorBebida(b)}><div className={styles.cardBody}><h3>{nomeBebida(b)}</h3><p className={styles.price}>{brl(precoBebida(b))}</p><button type="button" className={styles.primary} disabled={!sacola.pronta} onClick={() => adicionar({ tipo: "bebida", bebida: b })}>Adicionar bebida</button></div></article>)}</div>{bebidasVisiveis.length === 0 && <p className={styles.empty}>Nenhuma bebida encontrada.</p>}</section>}
    {(categoria === "todos" || categoria === "porcoes") && <section aria-label="Porções avulsas"><h2 className={styles.sectionTitle}>Porções avulsas</h2><div className={styles.grid}>{porcoesVisiveis.map((id) => <article className={`${styles.card} ${styles.simpleCard}`} key={id}><div className={styles.cardBody}><h3>{PORCOES[id].nome}</h3><p className={styles.description}>{PORCOES[id].molho}</p><p className={styles.price}>A partir de {brl(PORCOES[id].preco)}</p><button type="button" className={styles.primary} disabled={!sacola.pronta} onClick={() => adicionar({ tipo: "porcao", porcao: id })}>Adicionar porção</button></div></article>)}</div>{porcoesVisiveis.length === 0 && <p className={styles.empty}>Nenhuma porção encontrada.</p>}</section>}
    <p className={styles.notice}>{AVISO} Entrega e disponibilidade são confirmadas na finalização.</p>
    {mensagem && <div className={styles.success} role="status"><span>{mensagem}</span><button type="button" className={styles.textButton} onClick={() => { setMensagem(""); sacola.abrirSacola(); }}>Ver sacola</button><button type="button" className={styles.textButton} onClick={() => setMensagem("")} aria-label="Fechar aviso">×</button></div>}
    {edicao && <Editor key={edicao.id ?? "novo"} inicial={edicao} aoFechar={fechar} aoSalvar={(conteudo, quantidade) => {
      const ok = edicao.id ? sacola.atualizar(edicao.id, conteudo, quantidade) : !!sacola.adicionar(conteudo, quantidade);
      if (ok) { setMensagem(edicao.id ? "Item atualizado na sacola." : `${nomeDoConteudo(conteudo)} na sacola.`); fechar(); }
      return ok;
    }} />}
  </AcoesContext.Provider>;
}

function Quantidade({ valor, min = 0, max = 99, aoMudar, nome = "Quantidade" }: { valor: number; min?: number; max?: number; aoMudar: (n: number) => void; nome?: string }) {
  return <div className={styles.stepper} role="group" aria-label={nome}><button type="button" disabled={valor <= min} onClick={() => aoMudar(valor - 1)} aria-label={`Diminuir ${nome.toLowerCase()}`}>−</button><output>{valor}</output><button type="button" disabled={valor >= max} onClick={() => aoMudar(valor + 1)} aria-label={`Aumentar ${nome.toLowerCase()}`}>+</button></div>;
}

function Editor({ inicial, aoFechar, aoSalvar }: { inicial: Edicao; aoFechar: () => void; aoSalvar: (conteudo: ConteudoSacola, quantidade: number) => boolean }) {
  const [conteudo, setConteudo] = useState(inicial.conteudo);
  const [quantidade, setQuantidade] = useState(inicial.quantidade);
  const [erro, setErro] = useState("");
  const painel = usePainelModal(true, aoFechar);
  const pedido = conteudo.tipo === "lanche" ? conteudo.pedido : null;
  const mudarPedido = (f: (p: Pedido) => Pedido) => setConteudo((c) => c.tipo === "lanche" ? { ...c, pedido: f(c.pedido) } : c);
  const trio = pedido ? trioDe(pedido.lanche) : null;
  const preco = pedido ? totalDoPedido(pedido) : conteudo.tipo === "bebida" ? precoBebida(conteudo.bebida) : conteudo.tipo === "porcao" ? PORCOES[conteudo.porcao].preco : 0;
  function salvar() {
    if (pedido?.opcoes) for (const grupo of ORDEM_GRUPOS) if (!pedido.opcoes[grupo]) {
      setErro(`Escolha ${GRUPOS[grupo].toLowerCase()} antes de adicionar.`); painel.current?.querySelector<HTMLSelectElement>(`#editor-${grupo}`)?.focus(); return;
    }
    if (pedido?.combo && !saborDaLataDoCombo(pedido)) { setErro("Escolha o sabor da lata incluída no combo."); painel.current?.querySelector<HTMLSelectElement>("#editor-lata-combo")?.focus(); return; }
    if (!aoSalvar(conteudo, quantidade)) setErro("Não foi possível salvar este item. Ele pode ter sido removido; confira a sacola.");
  }
  return <div className={styles.overlay}><div className={styles.panel} ref={painel} role="dialog" aria-modal="true" aria-labelledby="titulo-editor" aria-describedby="aviso-rascunho" tabIndex={-1}>
    <header className={styles.panelHeader}><div><h2 id="titulo-editor">{inicial.id ? "Editar" : "Personalizar"} {nomeDoConteudo(conteudo)}</h2><p className={styles.smallNote} id="aviso-rascunho">As alterações só entram na sacola ao salvar. Fechar descarta este rascunho.</p></div><button type="button" className={styles.close} onClick={aoFechar} aria-label="Cancelar edição">×</button></header>
    <div className={styles.panelBody}>
      {pedido && <>
        {pedido.opcoes && <fieldset className={styles.fieldset}><legend className={styles.legend}>Ingredientes do lanche</legend><p className={styles.smallNote}>As escolhas abaixo não alteram o preço base.</p>{ORDEM_GRUPOS.map((grupo) => <label className={styles.field} key={grupo} htmlFor={`editor-${grupo}`}>{GRUPOS[grupo]}<select id={`editor-${grupo}`} className={styles.select} value={pedido.opcoes?.[grupo] ?? ""} onChange={(e) => { const valor = e.target.value; mudarPedido((p) => ({ ...p, opcoes: { ...p.opcoes!, [grupo]: valor || null } })); setErro(""); }}><option value="">Escolha uma opção</option>{OPCOES[grupo].map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}{grupo !== "pao" && <option value="sem">{SEM_OPCAO[grupo].nome}</option>}</select></label>)}</fieldset>}
        <fieldset className={styles.fieldset}><legend className={styles.legend}>Adicionais no lanche</legend>{ORDEM_ADICIONAIS.map((id) => <div key={id} className={styles.optionRow}><div>{ADICIONAIS[id].nome}<small>+ {brl(ADICIONAIS[id].preco)} por unidade</small></div><Quantidade valor={pedido.adicionais[id] ?? 0} max={ADICIONAIS[id].max} nome={ADICIONAIS[id].nome} aoMudar={(n) => mudarPedido((p) => ({ ...p, adicionais: { ...p.adicionais, [id]: n } }))} /></div>)}</fieldset>
        <fieldset className={styles.fieldset}><legend className={styles.legend}>Potinhos separados</legend>{ORDEM_SEPARADOS.map((id) => <div key={id} className={styles.optionRow}><div>{SEPARADOS[id].nome}<small>+ {brl(SEPARADOS[id].preco)} por unidade</small></div><Quantidade valor={pedido.separados[id] ?? 0} max={SEPARADOS[id].max} nome={SEPARADOS[id].nome} aoMudar={(n) => mudarPedido((p) => ({ ...p, separados: { ...p.separados, [id]: n } }))} /></div>)}</fieldset>
        {trio && <fieldset className={styles.fieldset}><legend className={styles.legend}>Quer um combo?</legend><label className={styles.check}><input type="checkbox" checked={pedido.combo} onChange={(e) => { const combo = e.target.checked; mudarPedido((p) => ({ ...p, combo })); }} /><span>{trio.nome} · {brl(trio.preco)}<span className={styles.smallNote}> — troca o lanche avulso por lanche + {trio.batata} + 1 refri lata. Adicionais são cobrados à parte.</span></span></label>{pedido.combo && pedido.bebida?.id !== "lata" && <label className={styles.field} htmlFor="editor-lata-combo">Sabor da lata incluída<select id="editor-lata-combo" className={styles.select} value={pedido.lataCombo ?? ""} onChange={(e) => { const sabor = e.target.value as SaborLata; mudarPedido((p) => ({ ...p, lataCombo: sabor || null })); setErro(""); }}><option value="">Escolha o sabor</option>{ORDEM_SABORES_LATA.map((s) => <option key={s} value={s}>{SABORES_LATA[s].nome}</option>)}</select></label>}</fieldset>}
        <label className={styles.field}>Bebida junto do lanche<select className={styles.select} value={valorBebida(pedido.bebida)} onChange={(e) => { const bebida = bebidaDoValor(e.target.value); mudarPedido((p) => ({ ...p, bebida })); }}><option value="">Sem bebida extra</option>{bebidas.map((b) => <option key={valorBebida(b)} value={valorBebida(b)}>{nomeBebida(b)} · {pedido.combo && b.id === "lata" ? "incluída no combo" : `+ ${brl(precoBebida(b))}`}</option>)}</select><span className={styles.smallNote}>{pedido.combo ? "Uma lata selecionada aqui será a bebida do combo. Chopp e soda são cobrados à parte, além da lata incluída." : "A bebida será incluída na mesma linha do lanche."}</span></label>
        <label className={styles.field}>Porção junto do lanche<select className={styles.select} value={pedido.porcao ?? ""} onChange={(e) => { const porcao = e.target.value as PorcaoId; mudarPedido((p) => ({ ...p, porcao: porcao || null })); }}><option value="">Sem porção extra</option>{ORDEM_PORCOES.map((p) => <option key={p} value={p}>{PORCOES[p].nome} · a partir de + {brl(PORCOES[p].preco)}</option>)}</select>{pedido.combo && <span className={styles.smallNote}>Esta porção é extra: a batata do combo continua incluída.</span>}</label>
      </>}
      {conteudo.tipo === "bebida" && <label className={styles.field}>Bebida avulsa<select className={styles.select} value={valorBebida(conteudo.bebida)} onChange={(e) => { const bebida = bebidaDoValor(e.target.value); if (bebida) setConteudo({ tipo: "bebida", bebida }); }}>{bebidas.map((b) => <option key={valorBebida(b)} value={valorBebida(b)}>{nomeBebida(b)} · {brl(precoBebida(b))}</option>)}</select></label>}
      {conteudo.tipo === "porcao" && <label className={styles.field}>Porção avulsa<select className={styles.select} value={conteudo.porcao} onChange={(e) => setConteudo({ tipo: "porcao", porcao: e.target.value as PorcaoId })}>{ORDEM_PORCOES.map((p) => <option key={p} value={p}>{PORCOES[p].nome} · a partir de {brl(PORCOES[p].preco)}</option>)}</select></label>}
      <div className={styles.optionRow}><div><strong>Quantidade</strong><p className={styles.smallNote}>Multiplica este item com todos os adicionais, bebida e porção selecionados.</p></div><Quantidade valor={quantidade} min={1} nome="Quantidade do item" aoMudar={setQuantidade} /></div>
      {erro && <p role="alert" className={styles.error}>{erro}</p>}
    </div><footer className={styles.panelFooter}><div><p className={styles.smallNote}>Total · {quantidade} {quantidade === 1 ? "unidade" : "unidades"}</p><strong className={styles.price}>{brl(preco * quantidade)}</strong></div><button type="button" className={styles.primary} onClick={salvar}>{inicial.id ? "Salvar alterações" : "Adicionar à sacola"}</button><button type="button" className={styles.textButton} onClick={aoFechar}>Cancelar</button></footer>
  </div></div>;
}
