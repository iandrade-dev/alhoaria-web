import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stdin } from "node:process";
import { pathToFileURL } from "node:url";

const dados = new URL("./catalogo-inicial.json", import.meta.url);

function referenciasAusentes(inicial, existente) {
  const faltam = [];
  for (const grupo of inicial.optionGroups ?? []) {
    const salvo = existente.optionGroups.find(g => g.reference === grupo.reference);
    if (!salvo || !salvo.options.some(o => grupo.options.some(esperada => esperada.reference === o.reference))) {
      faltam.push(grupo.reference);
    }
    for (const opcao of salvo?.options ?? []) {
      const conhecida = grupo.options.find(o => o.name === opcao.name);
      if (conhecida && !opcao.reference) faltam.push(`${grupo.reference}/${conhecida.reference}`);
    }
  }
  for (const variante of existente.variants) {
    const conhecida = inicial.variants?.find(v => v.label === variante.label);
    if (conhecida && !variante.reference) faltam.push(conhecida.reference);
  }
  if (inicial.reference === "bebida-lata" && !existente.variants.some(v => inicial.variants.some(esperada => esperada.reference === v.reference))) {
    faltam.push("sabores da lata");
  }
  return faltam;
}

export async function importarCatalogo(origem, empresa, token, slug = "alhoaria") {
  async function chamar(path, { metodo = "GET", json, foto, chave } = {}) {
    const headers = { authorization: `Bearer ${token}`, accept: "application/json" };
    if (chave) headers["idempotency-key"] = chave;
    let body;
    if (foto) {
      headers["content-type"] = "image/webp";
      headers["x-file-name"] = foto.nome;
      body = foto.bytes;
    }
    if (json) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    const resposta = await fetch(origem + path, {
      method: metodo, headers, body, redirect: "error", signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) throw new Error(`${metodo} ${path} respondeu HTTP ${resposta.status}.`);
    return resposta.json();
  }

  async function listar(path) {
    const lista = [];
    let cursor;
    do {
      const busca = new URLSearchParams({ limit: "100", ...(cursor && { cursor }) });
      const pagina = await chamar(`${path}?${busca}`);
      lista.push(...pagina.items);
      cursor = pagina.nextCursor;
    } while (cursor);
    return lista;
  }

  const config = await chamar(`/v1/tenancy/companies/${empresa}/settings`);
  if (config.publicSlug !== slug) throw new Error("A empresa informada tem outro endereço de cardápio.");
  const produtos = `/v1/catalog/companies/${empresa}/products`;
  const categorias = `/v1/catalog/companies/${empresa}/categories`;
  const existentes = await listar(produtos);
  const inicial = JSON.parse(await readFile(dados, "utf8"));
  const incompletos = inicial.flatMap(item => {
    const salvo = existentes.find(p => p.reference === item.reference);
    return salvo ? referenciasAusentes(item, salvo).map(ref => `${item.reference}/${ref}`) : [];
  });
  if (incompletos.length) {
    throw new Error("Complete no painel as referências das opções já cadastradas: " + incompletos.join(", "));
  }
  const novas = inicial.filter(item => !existentes.some(p => p.reference === item.reference));
  const conflitantes = novas.filter(item => existentes.some(p => p.name === item.name));
  if (conflitantes.length) {
    throw new Error("Associe no painel as referências do produto e de suas opções antes de importar: " + conflitantes.map(item => item.reference).join(", "));
  }
  const { items } = await chamar(categorias);
  const porNome = new Map(items.map(item => [item.name, item.id]));
  const pastaMidia = `/v1/media/companies/${empresa}/assets`;
  const midias = novas.some(item => item.foto) ? await listar(pastaMidia) : [];
  const porArquivo = new Map(midias.filter(midia => midia.kind === "image").map(midia => [midia.originalName, midia]));
  for (const { category, foto, ...produto } of novas) {
    if (!porNome.has(category)) {
      const categoria = await chamar(categorias, { metodo: "POST", json: { name: category, sortOrder: porNome.size } });
      porNome.set(category, categoria.id);
    }
    let imagem;
    if (foto) {
      const bytes = await readFile(new URL("../public/" + foto, import.meta.url));
      const hash = createHash("sha256").update(bytes).digest("hex");
      const nome = `alhoaria-${produto.reference}-${hash}.webp`;
      imagem = porArquivo.get(nome) ?? await chamar(pastaMidia, { metodo: "POST", foto: { nome, bytes } });
      porArquivo.set(nome, imagem);
    }
    const json = {
      ...produto, categoryId: porNome.get(category), sortOrder: inicial.findIndex(item => item.reference === produto.reference),
      ...(imagem ? { photoIds: [imagem.id] } : {}),
    };
    const chave = createHash("sha256").update(`alhoaria-catalogo:${empresa}:${produto.reference}`).digest("hex");
    await chamar(produtos, { metodo: "POST", json, chave });
  }
  return { criados: novas.length, existentes: inicial.length - novas.length };
}

async function main() {
  const [endereco, empresa, slug = "alhoaria", ...extras] = process.argv.slice(2);
  const url = URL.parse(endereco ?? "");
  const local = url?.hostname === "127.0.0.1" || url?.hostname === "localhost";
  if (!url || url.href !== url.origin + "/" || !(url.protocol === "https:" || (local && url.protocol === "http:"))
    || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(empresa ?? "") || extras.length
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Uso: node scripts/importar-catalogo.mjs ORIGEM_API ID_EMPRESA [SLUG] com o token da conta mestre na entrada padrão.");
  }
  if (stdin.isTTY) throw new Error("Forneça o token pela entrada padrão.");
  const partes = [];
  for await (const parte of stdin) partes.push(parte);
  const token = Buffer.concat(partes).toString("utf8").trim();
  if (!token || /\s/.test(token)) throw new Error("Token inválido na entrada padrão.");
  const { criados, existentes } = await importarCatalogo(url.origin, empresa, token, slug);
  console.log(`${criados} produtos gravados no rascunho e ${existentes} já existentes. Confira e publique o rascunho no painel.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(erro => {
    console.error(erro.message);
    process.exitCode = 1;
  });
}
