"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { brl, nomeBebida, ORDEM_PORCOES, PORCOES, precoBebidaAvulsa, totalDoPedido, type Pedido as PedidoLanche } from "@/components/bancada-proto/cardapio";
import { Editor, Quantidade, bebidas, normalizarBusca, padrao, valorBebida, type Edicao } from "@/components/pedido/CardapioRapido";
import { nomeDoConteudo, usePainelModal } from "@/components/pedido/Sacola";
import pedidoStyles from "@/components/pedido/pedido.module.css";
import { CATALOGO } from "@/data/catalogo";
import { restaurante } from "@/data/restaurante";
import { criarClienteGarcom, ErroGarcom, podeEnviar, type LocalDeTrabalho, type Pedido, type Usuario } from "@/lib/garcom-api";
import {
  assinaturaDoEnvio, chaveDoEnvio, itensDaLinha, lerRascunho, MAX_MESA, MAX_OBSERVACAO, MAX_QUANTIDADE_ITEM, montarPedido, novaChave, pedidosDeHoje, rascunhoVazio, STATUS, totalDaComanda,
  type Rascunho,
} from "@/lib/garcom-pedido";
import { atualizarItem, normalizarConteudo, removerItem, type ConteudoSacola, type ItemSacola } from "@/lib/sacola";
import styles from "./garcom.module.css";

const cliente = criarClienteGarcom();
const CHAVE_RASCUNHO = `garcom:rascunho:${restaurante.id}`;
const CHAVE_LOCAL = `garcom:local:${restaurante.id}`;
const INTERVALO = 5000;
const PAPEIS: Record<LocalDeTrabalho["role"], string> = { admin: "Administração", waiter: "Garçom", kitchen: "Cozinha (só acompanha)" };
const hora = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const ler = (chave: string) => { try { return window.localStorage.getItem(chave); } catch { return null; } };
const gravar = (chave: string, valor: string | null) => { try { if (valor === null) window.localStorage.removeItem(chave); else window.localStorage.setItem(chave, valor); } catch { /* sem armazenamento: a comanda fica só nesta aba */ } };
const mesmoConteudo = (a: ConteudoSacola, b: ConteudoSacola) => JSON.stringify(a) === JSON.stringify(b);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

type Fase = "verificando" | "login" | "locais" | "pronto";

export default function Garcom() {
  const [fase, setFase] = useState<Fase>("verificando");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [locais, setLocais] = useState<LocalDeTrabalho[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [aviso, setAviso] = useState("");

  const sessaoExpirou = useCallback(() => { setUsuario(null); setFase("login"); setAviso("Sua sessão terminou. Entre novamente; a comanda em andamento continua guardada."); }, []);

  const carregarLocais = useCallback(async (signal?: AbortSignal) => {
    try {
      const lista = await cliente.locais(signal);
      setLocais(lista);
      const salvo = ler(CHAVE_LOCAL);
      const escolhido = lista.find((l) => l.companyId === salvo) ?? (lista.length === 1 ? lista[0] : null);
      if (escolhido) { setCompanyId(escolhido.companyId); setFase("pronto"); } else setFase("locais");
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      if (e instanceof ErroGarcom && e.tipo === "sessao") return sessaoExpirou();
      setAviso(e instanceof ErroGarcom ? e.message : "Não foi possível carregar suas lojas."); setFase("locais");
    }
  }, [sessaoExpirou]);

  useEffect(() => {
    const controle = new AbortController();
    cliente.sessao(controle.signal)
      .then((u) => { setUsuario(u); return carregarLocais(controle.signal); })
      .catch((e: unknown) => {
        if (controle.signal.aborted) return;
        if (e instanceof ErroGarcom && e.tipo === "indisponivel") setAviso(e.message);
        setFase("login");
      });
    return () => controle.abort();
  }, [carregarLocais]);

  async function sair() {
    try { await cliente.sair(); } catch { /* a sessão local é descartada mesmo assim */ }
    setUsuario(null); setLocais([]); setCompanyId(""); setAviso(""); setFase("login");
  }
  function escolherLocal(id: string) { gravar(CHAVE_LOCAL, id); setCompanyId(id); setAviso(""); setFase("pronto"); }

  if (fase === "verificando") return <div className={styles.entrada} aria-busy="true"><p className={styles.entradaSub}>Abrindo o modo garçom…</p></div>;
  if (fase === "login") return <Login aviso={aviso} aoEntrar={(u) => { setUsuario(u); setAviso(""); void carregarLocais(); }} />;
  const local = locais.find((l) => l.companyId === companyId);
  if (fase === "locais" || !local) return <EscolhaLocal locais={locais} aviso={aviso} aoEscolher={escolherLocal} aoSair={sair} aoTentar={() => { setAviso(""); void carregarLocais(); }} />;
  return <Mesa key={local.companyId} usuario={usuario} local={local} trocarLocal={locais.length > 1 ? () => setFase("locais") : undefined} aoSair={sair} sessaoExpirou={sessaoExpirou} />;
}

function Entrada({ children }: { children: React.ReactNode }) {
  return <div className={styles.entrada}><div className={styles.entradaCaixa}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={restaurante.logo} alt={restaurante.nome} className={styles.entradaLogo} width={88} height={88} />
    <h1 className={styles.entradaTitulo}>Modo garçom</h1>
    {children}
  </div></div>;
}

function Login({ aviso, aoEntrar }: { aviso: string; aoEntrar: (u: Usuario) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  async function entrar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setErro("");
    try { const u = await cliente.entrar(email.trim(), senha); setSenha(""); aoEntrar(u); }
    catch (causa) { setErro(causa instanceof ErroGarcom ? causa.message : "Não foi possível entrar. Tente novamente."); }
    finally { setOcupado(false); }
  }
  return <Entrada>
    <p className={styles.entradaSub}>Área da equipe {restaurante.nome}. Entre com a sua conta do painel.</p>
    <form onSubmit={entrar} noValidate>
      {(erro || aviso) && <p className={styles.erroEntrada} role="alert">{erro || aviso}</p>}
      <label className={styles.campo}>E-mail<input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className={styles.campo}>Senha<input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
      <button type="submit" className={styles.entrar} disabled={ocupado || !email.trim() || !senha}>{ocupado ? "Entrando…" : "Entrar"}</button>
    </form>
  </Entrada>;
}

function EscolhaLocal({ locais, aviso, aoEscolher, aoSair, aoTentar }: { locais: LocalDeTrabalho[]; aviso: string; aoEscolher: (id: string) => void; aoSair: () => void; aoTentar: () => void }) {
  return <Entrada>
    <p className={styles.entradaSub}>{locais.length ? "Onde você está trabalhando agora?" : "Sua conta ainda não está ligada a nenhuma loja."}</p>
    {aviso && <p className={styles.erroEntrada} role="alert">{aviso} <button type="button" className={styles.topoTexto} onClick={aoTentar} style={{ textDecoration: "underline" }}>Tentar de novo</button></p>}
    {locais.map((l) => <button type="button" key={l.companyId} className={styles.local} onClick={() => aoEscolher(l.companyId)}><div><strong>{l.companyName}</strong><span style={{ display: "block" }}>{PAPEIS[l.role] ?? l.role}</span></div><span aria-hidden="true">→</span></button>)}
    <button type="button" className={styles.linkClaro} onClick={aoSair}>Sair</button>
  </Entrada>;
}

type Aba = "novo" | "pedidos";

function Mesa({ usuario, local, trocarLocal, aoSair, sessaoExpirou }: { usuario: Usuario | null; local: LocalDeTrabalho; trocarLocal?: () => void; aoSair: () => void; sessaoExpirou: () => void }) {
  const pode = podeEnviar(local.role);
  const [aba, setAba] = useState<Aba>(pode ? "novo" : "pedidos");
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio);
  const [carregado, setCarregado] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [comandaAberta, setComandaAberta] = useState(false);
  const [toast, setToast] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<ErroGarcom | null>(null);
  const [erroLocal, setErroLocal] = useState("");
  const [confirmado, setConfirmado] = useState<Pedido | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [listaOk, setListaOk] = useState<{ quando: string; erro: string } | null>(null);
  const [busca, setBusca] = useState("");
  const mesaRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRascunho(lerRascunho(ler(CHAVE_RASCUNHO))); setCarregado(true); }, []);
  useEffect(() => { if (carregado) gravar(CHAVE_RASCUNHO, rascunho.itens.length || rascunho.mesa || rascunho.observacao ? JSON.stringify(rascunho) : null); }, [rascunho, carregado]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  const atualizar = (f: (r: Rascunho) => Rascunho) => { setRascunho(f); setErroLocal(""); setErroEnvio(null); };

  const carregarPedidos = useCallback(async (signal?: AbortSignal) => {
    try {
      const lista = await cliente.pedidos(local.companyId, "all", signal);
      setPedidos(pedidosDeHoje(lista)); setListaOk({ quando: new Date().toISOString(), erro: "" });
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      if (e instanceof ErroGarcom && e.tipo === "sessao") return sessaoExpirou();
      setListaOk((v) => ({ quando: v?.quando ?? "", erro: e instanceof ErroGarcom ? e.message : "Não foi possível atualizar os pedidos." }));
    }
  }, [local.companyId, sessaoExpirou]);

  useEffect(() => {
    let controle = new AbortController();
    const rodar = () => { if (document.hidden) return; controle.abort(); controle = new AbortController(); void carregarPedidos(controle.signal); };
    rodar();
    const id = setInterval(rodar, INTERVALO);
    document.addEventListener("visibilitychange", rodar);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", rodar); controle.abort(); };
  }, [carregarPedidos]);

  function adicionar(conteudo: ConteudoSacola, quantidade = 1) {
    const c = normalizarConteudo(conteudo);
    if (!c) return false;
    atualizar((r) => {
      const igual = r.itens.find((i) => mesmoConteudo(i.conteudo, c) && i.quantidade + quantidade <= MAX_QUANTIDADE_ITEM);
      const itens = igual ? r.itens.map((i) => i === igual ? { ...i, quantidade: i.quantidade + quantidade } : i) : [...r.itens, { id: novaChave(), quantidade, conteudo: c }];
      return { ...r, itens };
    });
    setToast(`${nomeDoConteudo(c)} +${quantidade}`); setConfirmado(null);
    return true;
  }
  function salvarEdicao(conteudo: ConteudoSacola, quantidade: number) {
    if (!edicao) return false;
    if (!edicao.id) { const ok = adicionar(conteudo, quantidade); if (ok) setEdicao(null); return ok; }
    const itens = atualizarItem(rascunho.itens, edicao.id, conteudo, quantidade);
    if (!itens) return false;
    atualizar((r) => ({ ...r, itens })); setEdicao(null); return true;
  }

  async function enviar() {
    const montado = montarPedido(rascunho.mesa, rascunho.observacao, rascunho.itens);
    if (!montado.ok) { setErroLocal(montado.erro); if (!rascunho.mesa.trim()) mesaRef.current?.focus(); setComandaAberta(true); return; }
    const pendente = chaveDoEnvio(rascunho.pendente, assinaturaDoEnvio(local.companyId, montado.pedido), novaChave);
    // Grava a chave antes de enviar: se a aba fechar no meio, o reenvio não duplica o pedido.
    setRascunho((r) => ({ ...r, pendente })); gravar(CHAVE_RASCUNHO, JSON.stringify({ ...rascunho, pendente }));
    setEnviando(true); setErroEnvio(null);
    try {
      const pedido = await cliente.enviar(local.companyId, montado.pedido, pendente.chave);
      setConfirmado(pedido); setRascunho(rascunhoVazio());
      setPedidos((lista) => [pedido, ...lista.filter((p) => p.id !== pedido.id)]);
    } catch (e) {
      const erro = e instanceof ErroGarcom ? e : new ErroGarcom("indisponivel", "Não foi possível enviar. O pedido continua aqui; tente de novo.");
      if (erro.tipo === "sessao") { sessaoExpirou(); return; }
      if (erro.codigo === "idempotency_key_reused") setRascunho((r) => ({ ...r, pendente: null }));
      setErroEnvio(erro);
    } finally { setEnviando(false); }
  }

  const qtd = rascunho.itens.reduce((n, i) => n + i.quantidade, 0);
  const total = totalDaComanda(rascunho.itens);
  const abertos = pedidos.filter((p) => STATUS[p.status]?.aberto).length;
  const nome = usuario?.displayName || usuario?.email || "";

  return <div className={styles.app}>
    <header className={styles.topo}>
      <div className={styles.topoLinha}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={restaurante.logo} alt="" className={styles.logo} width={36} height={36} />
        <div className={styles.topoTexto}>
          <strong>Modo garçom{nome ? ` · ${nome.split(/[ @]/)[0]}` : ""}</strong>
          {trocarLocal ? <button type="button" onClick={trocarLocal} aria-label={`Loja atual: ${local.companyName}. Trocar de loja`}>{local.companyName} · trocar</button> : <span>{local.companyName}</span>}
        </div>
        <button type="button" className={styles.sair} onClick={aoSair}>Sair</button>
      </div>
      <div className={styles.abas} role="tablist" aria-label="Modo garçom">
        {pode && <button type="button" role="tab" id="aba-novo" aria-controls="painel-novo" aria-selected={aba === "novo"} className={styles.aba} onClick={() => setAba("novo")}>Novo pedido{qtd > 0 && <span className={styles.contador}>{qtd}</span>}</button>}
        <button type="button" role="tab" id="aba-pedidos" aria-controls="painel-pedidos" aria-selected={aba === "pedidos"} className={styles.aba} onClick={() => setAba("pedidos")} style={pode ? undefined : { gridColumn: "1 / -1" }}>Pedidos de hoje{abertos > 0 && <span className={styles.contador}>{abertos}</span>}</button>
      </div>
    </header>

    {aba === "novo" && pode && <main className={styles.corpo} role="tabpanel" id="painel-novo" aria-labelledby="aba-novo">
      <div className={styles.mesa}>
        <label htmlFor="mesa">Mesa</label>
        <input id="mesa" ref={mesaRef} className={`${styles.mesaInput} ${erroLocal && !rascunho.mesa.trim() ? styles.mesaVazia : ""}`} inputMode="numeric" autoComplete="off" enterKeyHint="done" maxLength={MAX_MESA} placeholder="nº" value={rascunho.mesa} onChange={(e) => { const mesa = e.target.value; atualizar((r) => ({ ...r, mesa })); }} />
      </div>
      {confirmado && <p className={styles.info} role="status">Pedido nº {confirmado.number} da mesa {confirmado.table} foi para a cozinha. <button type="button" className={pedidoStyles.textButton} onClick={() => setAba("pedidos")}>Acompanhar</button></p>}
      <Catalogo busca={busca} setBusca={setBusca} itens={rascunho.itens} aoAdicionar={adicionar} aoPersonalizar={(conteudo) => setEdicao({ quantidade: 1, conteudo })} />
    </main>}

    {aba === "pedidos" && <main className={styles.corpo} role="tabpanel" id="painel-pedidos" aria-labelledby="aba-pedidos">
      <ListaPedidos pedidos={pedidos} estado={listaOk} local={local} aoAtualizar={() => carregarPedidos()} sessaoExpirou={sessaoExpirou} aoMudar={(p) => setPedidos((lista) => lista.map((x) => x.id === p.id ? p : x))} />
    </main>}

    {aba === "novo" && pode && <div className={styles.barra}><div className={styles.barraLinha}>
      <div className={styles.barraTexto}><strong>{brl(total)}</strong><span>{rascunho.mesa.trim() ? `Mesa ${rascunho.mesa.trim()}` : "Sem mesa"} · {plural(qtd, "item", "itens")}</span></div>
      <button type="button" className={styles.barraBotao} disabled={qtd === 0} onClick={() => { setErroEnvio(null); setComandaAberta(true); }}>Revisar e enviar</button>
    </div></div>}

    {toast && !comandaAberta && !edicao && <div className={styles.toast} role="status">{toast}</div>}

    {comandaAberta && <Comanda rascunho={rascunho} enviando={enviando} erroEnvio={erroEnvio} erroLocal={erroLocal} confirmado={confirmado}
      aoMudar={atualizar} aoEditar={(item) => setEdicao({ id: item.id, quantidade: item.quantidade, conteudo: JSON.parse(JSON.stringify(item.conteudo)) as ConteudoSacola })}
      aoEnviar={enviar} aoFechar={() => { setComandaAberta(false); if (confirmado) setConfirmado(null); }}
      aoNovo={() => { setComandaAberta(false); setConfirmado(null); setTimeout(() => mesaRef.current?.focus(), 0); }}
      aoVerPedidos={() => { setComandaAberta(false); setConfirmado(null); setAba("pedidos"); }} />}

    {edicao && <Editor key={edicao.id ?? "novo"} inicial={edicao} aoFechar={() => setEdicao(null)} aoSalvar={salvarEdicao}
      destino={{ adicionar: "Adicionar à comanda", aviso: "As escolhas só entram na comanda da mesa ao salvar.", erro: "Não foi possível salvar este item. Confira a comanda." }} />}
  </div>;
}

function Catalogo({ busca, setBusca, itens, aoAdicionar, aoPersonalizar }: { busca: string; setBusca: (v: string) => void; itens: ItemSacola[]; aoAdicionar: (c: ConteudoSacola) => boolean; aoPersonalizar: (c: ConteudoSacola) => void }) {
  const termo = normalizarBusca(busca.trim());
  const naComanda = (f: (c: ConteudoSacola) => boolean) => itens.filter((i) => f(i.conteudo)).reduce((n, i) => n + i.quantidade, 0);
  const lanches = CATALOGO.filter((p) => normalizarBusca(`${p.nome} ${p.descricao}`).includes(termo));
  const listaBebidas = bebidas.filter((b) => normalizarBusca(nomeBebida(b)).includes(termo));
  const porcoes = ORDEM_PORCOES.filter((p) => normalizarBusca(`${PORCOES[p].nome} ${PORCOES[p].molho}`).includes(termo));
  const Selo = ({ n }: { n: number }) => n > 0 ? <span className={styles.naComanda} aria-label={`${n} na comanda`}>{n}</span> : null;
  return <>
    <label className={pedidoStyles.visuallyHidden} htmlFor="busca-garcom">Buscar no cardápio</label>
    <input id="busca-garcom" className={pedidoStyles.search} style={{ width: "100%" }} type="search" placeholder="Buscar lanche, bebida ou porção" value={busca} onChange={(e) => setBusca(e.target.value)} />
    {lanches.length > 0 && <><h2 className={styles.secao}>Lanches</h2><div className={styles.lista}>{lanches.map((p) => {
      const pedido: PedidoLanche = padrao(p.id);
      return <div className={styles.produto} key={p.id}>
        <div className={styles.produtoTexto}><h3>{p.nome}<Selo n={naComanda((c) => c.tipo === "lanche" && c.pedido.lanche === p.id)} /></h3><p>{brl(totalDoPedido(pedido))} · padrão da casa</p></div>
        <button type="button" className={styles.opcoes} onClick={() => aoPersonalizar({ tipo: "lanche", pedido: padrao(p.id) })} aria-label={`Personalizar ${p.nome}`}>Opções</button>
        <button type="button" className={styles.mais} onClick={() => aoAdicionar({ tipo: "lanche", pedido: padrao(p.id) })} aria-label={`Adicionar ${p.nome} padrão`}>+</button>
      </div>;
    })}</div></>}
    {listaBebidas.length > 0 && <><h2 className={styles.secao}>Bebidas</h2><div className={styles.lista}>{listaBebidas.map((b) => <div className={styles.produto} key={valorBebida(b)}>
      <div className={styles.produtoTexto}><h3>{nomeBebida(b)}<Selo n={naComanda((c) => c.tipo === "bebida" && valorBebida(c.bebida) === valorBebida(b))} /></h3><p>{brl(precoBebidaAvulsa(b))}</p></div>
      <button type="button" className={styles.mais} onClick={() => aoAdicionar({ tipo: "bebida", bebida: b })} aria-label={`Adicionar ${nomeBebida(b)}`}>+</button>
    </div>)}</div></>}
    {porcoes.length > 0 && <><h2 className={styles.secao}>Porções</h2><div className={styles.lista}>{porcoes.map((id) => <div className={styles.produto} key={id}>
      <div className={styles.produtoTexto}><h3>{PORCOES[id].nome}<Selo n={naComanda((c) => c.tipo === "porcao" && c.porcao === id)} /></h3><p>a partir de {brl(PORCOES[id].preco)} · {PORCOES[id].molho}</p></div>
      <button type="button" className={styles.mais} onClick={() => aoAdicionar({ tipo: "porcao", porcao: id })} aria-label={`Adicionar ${PORCOES[id].nome}`}>+</button>
    </div>)}</div></>}
    {!lanches.length && !listaBebidas.length && !porcoes.length && <p className={styles.vazio}>Nada encontrado para “{busca}”.</p>}
  </>;
}

function Comanda({ rascunho, enviando, erroEnvio, erroLocal, confirmado, aoMudar, aoEditar, aoEnviar, aoFechar, aoNovo, aoVerPedidos }: {
  rascunho: Rascunho; enviando: boolean; erroEnvio: ErroGarcom | null; erroLocal: string; confirmado: Pedido | null;
  aoMudar: (f: (r: Rascunho) => Rascunho) => void; aoEditar: (i: ItemSacola) => void; aoEnviar: () => void; aoFechar: () => void; aoNovo: () => void; aoVerPedidos: () => void;
}) {
  const painel = usePainelModal(true, enviando ? () => {} : aoFechar);
  const total = useMemo(() => totalDaComanda(rascunho.itens), [rascunho.itens]);
  if (confirmado) return <div className={pedidoStyles.overlay}><div className={pedidoStyles.panel} ref={painel} role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacao" tabIndex={-1}>
    <div className={pedidoStyles.panelBody}><div className={styles.confirmacao} role="status">
      <p className={pedidoStyles.eyebrow}>Enviado para a cozinha</p>
      <p className={styles.numero} id="titulo-confirmacao" aria-label={`Pedido número ${confirmado.number}`}>nº {confirmado.number}</p>
      <p><strong>Mesa {confirmado.table}</strong> · {brl(confirmado.totalCents)} · {hora(confirmado.createdAt)}</p>
      <p className={pedidoStyles.smallNote}>Acompanhe o status na lista de pedidos de hoje.</p>
    </div></div>
    <footer className={pedidoStyles.panelFooter}><button type="button" className={`${pedidoStyles.primary} ${pedidoStyles.full}`} onClick={aoNovo} data-autofoco>Novo pedido</button><button type="button" className={`${pedidoStyles.secondary} ${pedidoStyles.full}`} onClick={aoVerPedidos}>Ver pedidos de hoje</button></footer>
  </div></div>;
  return <div className={pedidoStyles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) aoFechar(); }}><div className={pedidoStyles.panel} ref={painel} role="dialog" aria-modal="true" aria-labelledby="titulo-comanda" tabIndex={-1}>
    <header className={pedidoStyles.panelHeader}><div><h2 id="titulo-comanda">Comanda{rascunho.mesa.trim() ? ` · mesa ${rascunho.mesa.trim()}` : ""}</h2><p className={pedidoStyles.smallNote}>{plural(rascunho.itens.reduce((n, i) => n + i.quantidade, 0), "item", "itens")} · confira antes de enviar</p></div><button type="button" className={pedidoStyles.close} onClick={aoFechar} disabled={enviando} aria-label="Voltar ao cardápio">×</button></header>
    <div className={pedidoStyles.panelBody}>
      <label className={pedidoStyles.field} htmlFor="mesa-comanda">Mesa<input id="mesa-comanda" className={pedidoStyles.select} inputMode="numeric" autoComplete="off" maxLength={MAX_MESA} value={rascunho.mesa} data-autofoco={!rascunho.mesa.trim() || undefined} onChange={(e) => { const mesa = e.target.value; aoMudar((r) => ({ ...r, mesa })); }} /></label>
      {rascunho.itens.length === 0 && <p className={styles.vazio}>A comanda está vazia.</p>}
      {rascunho.itens.map((item) => <article className={styles.linhaComanda} key={item.id}>
        {itensDaLinha(item).map((linha, n) => <div key={n}><h3>{linha.quantity}x {linha.name}</h3>{linha.details && <ul className={styles.detalhes}>{linha.details.map((d) => <li key={d}>{d}</li>)}</ul>}</div>)}
        <div className={styles.linhaRodape}>
          <Quantidade valor={item.quantidade} min={1} max={MAX_QUANTIDADE_ITEM} nome={`Quantidade de ${nomeDoConteudo(item.conteudo)}`} aoMudar={(quantidade) => aoMudar((r) => ({ ...r, itens: r.itens.map((i) => i.id === item.id ? { ...i, quantidade } : i) }))} />
          <strong>{brl(itensDaLinha(item).reduce((s, l) => s + l.quantity * l.unitPriceCents, 0))}</strong>
        </div>
        <div className={pedidoStyles.actions}>
          <button type="button" className={pedidoStyles.textButton} onClick={() => aoEditar(item)}>Editar</button>
          <button type="button" className={pedidoStyles.textButton} onClick={() => aoMudar((r) => ({ ...r, itens: removerItem(r.itens, item.id) }))} aria-label={`Remover ${nomeDoConteudo(item.conteudo)}`}>Remover</button>
        </div>
      </article>)}
      <label className={pedidoStyles.field} style={{ marginTop: 16 }} htmlFor="observacao">Observação para a cozinha (opcional)<textarea id="observacao" className={pedidoStyles.textarea} style={{ minHeight: 84 }} maxLength={MAX_OBSERVACAO} placeholder="Ex.: sem cebola no segundo lanche, servir junto" value={rascunho.observacao} onChange={(e) => { const observacao = e.target.value; aoMudar((r) => ({ ...r, observacao })); }} /></label>
      {erroLocal && <p className={pedidoStyles.error} role="alert">{erroLocal}</p>}
      {erroEnvio && <div className={styles.alerta} role="alert">
        <strong>{erroEnvio.tipo === "permissao" ? "Sem permissão" : erroEnvio.tipo === "indisponivel" ? "Não foi enviado (ou não confirmou)" : "Não foi enviado"}</strong>
        {erroEnvio.message}
        {erroEnvio.repetivel && <> Tentar de novo sem mudar a comanda não duplica o pedido; na dúvida, confira os pedidos de hoje.</>}
      </div>}
    </div>
    <footer className={pedidoStyles.panelFooter}>
      <div className={pedidoStyles.total}><span>Total</span><span>{brl(total)}</span></div>
      <button type="button" className={`${pedidoStyles.primary} ${pedidoStyles.full}`} style={{ minHeight: 54, fontSize: 16 }} disabled={enviando || rascunho.itens.length === 0} onClick={aoEnviar} aria-busy={enviando}>
        {enviando ? "Enviando…" : erroEnvio?.repetivel ? "Tentar enviar de novo" : "Enviar para a cozinha"}
      </button>
      <button type="button" className={`${pedidoStyles.textButton} ${pedidoStyles.full}`} onClick={aoFechar} disabled={enviando}>Continuar adicionando</button>
    </footer>
  </div></div>;
}

function ListaPedidos({ pedidos, estado, local, aoAtualizar, aoMudar, sessaoExpirou }: { pedidos: Pedido[]; estado: { quando: string; erro: string } | null; local: LocalDeTrabalho; aoAtualizar: () => void; aoMudar: (p: Pedido) => void; sessaoExpirou: () => void }) {
  const [confirmar, setConfirmar] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  async function cancelar(p: Pedido) {
    setOcupado(p.id); setErro("");
    try { aoMudar(await cliente.cancelar(local.companyId, p)); setConfirmar(""); }
    catch (e) {
      if (e instanceof ErroGarcom && e.tipo === "sessao") return sessaoExpirou();
      setErro(e instanceof ErroGarcom ? (e.tipo === "conflito" ? `O pedido nº ${p.number} já mudou de status e não pode mais ser cancelado aqui.` : e.message) : "Não foi possível cancelar.");
      setConfirmar(""); aoAtualizar();
    } finally { setOcupado(""); }
  }
  return <>
    <p className={styles.atualizado} role="status" aria-live="polite">
      <span className={`${styles.ponto} ${estado?.erro ? styles.pontoOff : ""}`} aria-hidden="true" />
      {!estado ? "Carregando pedidos…" : estado.erro ? `${estado.erro} Tentando de novo a cada 5 s.` : `Atualizado às ${hora(estado.quando)} · a cada 5 s`}
    </p>
    {erro && <p className={styles.alerta} role="alert">{erro}</p>}
    {estado && !estado.erro && pedidos.length === 0 && <p className={styles.vazio}>Nenhum pedido hoje ainda.</p>}
    {pedidos.map((p) => {
      const st = STATUS[p.status] ?? { nome: p.status, aberto: true };
      return <article className={styles.pedido} key={p.id} aria-label={`Pedido ${p.number}, mesa ${p.table}, ${st.nome}`}>
        <div className={styles.pedidoTopo}><h3>Mesa {p.table} <span style={{ fontWeight: 600, color: "#715647", fontSize: 15 }}>· nº {p.number}</span></h3><span className={`${styles.status} ${styles[p.status] ?? ""}`}>{st.nome}</span></div>
        <p className={styles.pedidoMeta}>{hora(p.createdAt)}{p.createdBy?.name ? ` · ${p.createdBy.name}` : ""}</p>
        <ul className={styles.pedidoItens}>{p.items.map((i, n) => <li key={n}><strong>{i.quantity}x</strong> {i.name}{i.details?.length ? <span className={styles.detalhes} style={{ display: "block" }}>{i.details.join(" · ")}</span> : null}</li>)}</ul>
        {p.note && <p className={styles.info} style={{ margin: "10px 0 0", padding: "8px 10px" }}>Obs.: {p.note}</p>}
        <div className={styles.pedidoRodape}>
          <strong>{brl(p.totalCents)}</strong>
          {p.status === "queued" && podeEnviar(local.role) && (confirmar === p.id
            ? <span style={{ display: "flex", gap: 8 }}><button type="button" className={styles.cancelar} disabled={ocupado === p.id} onClick={() => cancelar(p)}>{ocupado === p.id ? "Cancelando…" : "Sim, cancelar"}</button><button type="button" className={pedidoStyles.textButton} onClick={() => setConfirmar("")}>Manter</button></span>
            : <button type="button" className={styles.cancelar} onClick={() => setConfirmar(p.id)}>Cancelar pedido</button>)}
        </div>
      </article>;
    })}
  </>;
}
