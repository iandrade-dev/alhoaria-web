// Kit dos lanches de pão de alho (A Costela, Pulled Pork!, Brócolis & Queijo!): pão aberto na tábua, pasta, creme,
// recheio em 3 punhados, tampa, mussarela e maçarico. A coreografia e as posições são as aprovadas na Costela;
// só o recheio (GLB, pote da estação e punhado da mão) muda.
import {
  AdditiveBlending, BoxGeometry, CylinderGeometry, Euler, Group, InstancedMesh, LatheGeometry, MathUtils, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, Plane, PlaneGeometry, PointLight, Quaternion, Vector2, Vector3,
} from "three";
import {
  ACOES, COSTELA, CREME, MACA, MUSS, OPEN, PASTA, TAMPA, anguloTampa, c01, cremeConcha, eOut3, lerp, mola, pastaBico, pulso, seg, type Medidas,
} from "./acoes";
import {
  CHAMA_DIR, OBJ, POSES, anelTextura, apoiar, caixa, clipar, clonar, devolverAsRaizes, fazerEstacao, fiapos, floretes, gradiente, guardarCasas, mats,
  planoX, porParaPegar, qBase, soltarNoMundo, tigela, type Estacao, type Kit,
} from "./kit";
import { MESA, type LancheDef } from "./layout";

type Recheio = NonNullable<LancheDef["recheio"]>;
/** Punhado do recheio (o que a mão leva e o que cai no pão). */
function punhadoDe(recheio: Recheio) {
  if (recheio === "brocolis-floretes") return new Mesh(floretes(12, 0.024, 7), new MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }));
  if (recheio === "pulled-pernil") {
    return new Mesh(fiapos(80, 0.024, ["#8a3a1a", "#a8461f", "#c2652a", "#b0582a", "#d6995e", "#5c2310"], 0.032, 0.0042, 13),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.42 }));
  }
  return new Mesh(fiapos(46, 0.024, ["#6b3418", "#8a4521", "#4a2010", "#a85a2c"], 0.026, 0.006, 11), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
}

export function kitPao(def: LancheDef, A: Record<string, Object3D>, M: Medidas): Kit {
  const recheio = def.recheio!;
  const idRecheio = def.passos.find((p) => p.tipo === "recheio")!.id;

  // ------------------------------------------------ lanche
  const L = (() => {
    const raiz = new Group();
    const tabua = clonar(A.tabua);
    const lanche = new Group();
    const pao = clonar(A.pao);
    const tampa = pao.getObjectByName("pao_tampa")!;
    const clip = { pasta: planoX(), creme: planoX(), muss: planoX(), grat: planoX() };
    const pasta = clonar(A.pasta); clipar(pasta, [clip.pasta]);
    const creme = clonar(A.creme); clipar(creme, [clip.creme]);
    const gratinado = clonar(A.gratinado); clipar(gratinado, [clip.grat]);
    mats(gratinado).forEach((m) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; });
    // recheio em 3 partes (cada uma cresce no seu punhado)
    const cortes = [-1, -0.044, 0.044, 1];
    const partes = COSTELA.xs.map((xc, i) => {
      const g = new Group(); g.position.set(xc, 0.042, 0);
      const c = clonar(A[recheio]); c.position.set(-xc, -0.042, 0);
      clipar(c, [new Plane(new Vector3(1, 0, 0), -cortes[i]), new Plane(new Vector3(-1, 0, 0), cortes[i + 1])]);
      g.add(c);
      return g;
    });
    const mussPiv = new Group();
    const muss = clonar(A.mussarela); clipar(muss, [clip.muss]);
    mussPiv.add(muss);
    lanche.add(pao, pasta, ...partes, creme, mussPiv, gratinado);
    raiz.add(tabua, lanche);
    // medidas
    M.pasta = caixa(pasta).max.y;
    M.costela = caixa(partes[1]).max.y;
    // O creme fica por cima do recheio no modelo; como ele vem antes no passo a passo, assenta na pasta
    // e sobe junto com o recheio quando ele cresce.
    const cremeTopo = caixa(creme).max.y;
    M.creme = M.pasta + 0.012;
    const cremeDy = cremeTopo - M.creme;
    const bm = caixa(muss);
    M.muss = bm.max.y - 0.006;
    mussPiv.position.set(0, bm.min.y + 0.03, 0); muss.position.set(0, -(bm.min.y + 0.03), 0);
    return { raiz, lanche, tampa, pasta, creme, partes, mussPiv, muss, gratinado, clip, cremeDy };
  })();

  // ------------------------------------------------ estações
  const E = (() => {
    const anelTex = anelTextura();
    const metal = new MeshStandardMaterial({ color: "#2a2624", roughness: 0.3, metalness: 0.85 });
    // bisnaga de bico para baixo num suporte, como em lanchonete: a mão pega já na pose de uso
    const bis = new Group(); const bisnaga = clonar(A.bisnaga);
    const supB = new Mesh(new LatheGeometry([[0, 0], [0.048, 0], [0.048, 0.006], [0.037, 0.01], [0.037, 0.058], [0.0325, 0.058], [0.0325, 0.012], [0, 0.012]].map(([x, y]) => new Vector2(x, y)), 36), metal);
    supB.castShadow = true; supB.receiveShadow = true; bis.add(supB);
    // pote de creme com a colher
    const pc = new Group(); const pote = clonar(A["pote-creme"]);
    const colher = pote.getObjectByName("colher")!;
    const colherOrig = { pai: colher.parent!, p: colher.position.clone(), q: colher.quaternion.clone() };
    pc.add(pote);
    // recheio numa tigela escura
    const pk = new Group();
    pk.add(tigela(0.072, 0.052, "#2b211c"));
    if (recheio === "brocolis-floretes") {
      // o miolo verde do GLB amassado no pote não lê como brócolis: o pote mostra um monte de floretes
      const monte = new Mesh(floretes(70, 0.056, 3, 1.35), new MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }));
      monte.position.y = 0.036; monte.scale.set(1, 0.55, 1); monte.castShadow = true; pk.add(monte);
    } else {
      [0.4, 1.9].forEach((ry, i) => {
        const c = clonar(A[recheio]); c.scale.set(0.4, 0.95, 1.12); c.rotation.y = ry;
        apoiar(c, 0, 0.012 + i * 0.006, 0); pk.add(c);
      });
    }
    const fCost = punhadoDe(recheio);
    fCost.castShadow = true;
    // mussarela ralada numa tigela de barro
    const pm = new Group();
    pm.add(tigela(0.07, 0.048, "#8c4a2b"));
    const ralada = new Mesh(fiapos(260, 0.058, ["#f3dc98", "#f6e4ae", "#ecd085"], 0.016, 0.0028, 5), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    ralada.position.y = 0.034; ralada.scale.set(1, 0.42, 1); pm.add(ralada);
    const fMuss = new Mesh(fiapos(60, 0.022, ["#f3dc98", "#f6e4ae", "#ecd085"], 0.016, 0.003, 9), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    fMuss.castShadow = true;
    // maçarico de bico para baixo num coldre (a mão pega quase na pose de uso)
    const ptm = new Group();
    const sup = new Mesh(new LatheGeometry([[0, 0], [0.045, 0], [0.045, 0.007], [0.026, 0.011], [0.023, 0.05], [0.019, 0.05], [0, 0.02]].map(([x, y]) => new Vector2(x, y)), 32), metal);
    sup.castShadow = true; ptm.add(sup);
    const maca = clonar(A["macarico-mao"]);
    maca.getObjectByName("chama")?.removeFromParent();

    const lista: Record<string, Estacao> = {
      pasta: fazerEstacao("pasta", bis, bisnaga, 0.04, 0.19, anelTex),
      creme: fazerEstacao("creme", pc, colher, 0.066, 0.08, anelTex),
      [idRecheio]: fazerEstacao(idRecheio, pk, fCost, 0.075, 0.07, anelTex),
      mussarela: fazerEstacao("mussarela", pm, fMuss, 0.072, 0.06, anelTex),
      macarico: fazerEstacao("macarico", ptm, maca, 0.05, 0.24, anelTex),
    };
    return { lista, bisnaga, pote, colher, colherOrig, fCost, fMuss, maca };
  })();

  // ------------------------------------------------ ferramentas na mão (no espaço da raiz da mão)
  const F = (() => {
    const bis = clonar(A.bisnaga); bis.position.copy(OBJ.bisnaga.p); bis.quaternion.copy(OBJ.bisnaga.q);
    const pote2 = clonar(A["pote-creme"]);
    const col = pote2.getObjectByName("colher")!; col.removeFromParent(); col.position.copy(OBJ.colher.p); col.quaternion.copy(OBJ.colher.q);
    const mac = clonar(A["macarico-mao"]); mac.position.copy(OBJ.macarico.p); mac.quaternion.copy(OBJ.macarico.q);
    const chama = mac.getObjectByName("chama")!;
    chama.traverse((n) => { if (n instanceof Mesh) { n.castShadow = false; } });
    const solta = new Vector3(...POSES.mao_punhado.ponto);
    const cost = E.fCost.clone(); cost.position.copy(solta).add(new Vector3(0, 0.01, 0));
    const muss = E.fMuss.clone(); muss.position.copy(solta).add(new Vector3(0, 0.01, 0));
    const fer: Record<string, Object3D | null> = { pasta: bis, creme: col, macarico: mac, [idRecheio]: cost, mussarela: muss, tampa: null };
    return { fer, chama };
  })();

  // ------------------------------------------------ efeitos
  const FX = (() => {
    const fio = new Mesh(new CylinderGeometry(0.0021, 0.0032, 1, 10, 1, true).translate(0, -0.5, 0), new MeshStandardMaterial({ color: "#f2e7c8", roughness: 0.32 }));
    fio.visible = false;
    const quedas = [0, 1, 2].map(() => { const c = E.fCost.clone(); c.visible = false; return c; });
    const N = 70;
    const ralada = new InstancedMesh(new BoxGeometry(0.003, 0.003, 0.016), new MeshStandardMaterial({ color: "#f3dc98", roughness: 0.5 }), N);
    ralada.visible = false; ralada.frustumCulled = false;
    const sem: number[][] = [];
    let s = 3; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) sem.push([rnd(), rnd(), rnd(), rnd(), rnd()]);
    const brilho = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: gradiente([[0, "rgba(255,210,140,1)"], [0.35, "rgba(255,140,40,0.55)"], [1, "rgba(255,90,20,0)"]]), transparent: true, depthWrite: false, blending: AdditiveBlending }));
    brilho.rotation.x = -Math.PI / 2; brilho.scale.setScalar(0.11); brilho.visible = false; brilho.renderOrder = 3;
    const luz = new PointLight("#ff8a33", 0, 0.5, 1.6);
    return { fio, quedas, ralada, sem, N, brilho, luz };
  })();

  // Posiciona as estações conforme o arranjo e guarda a "casa" de cada ferramenta (pose no mundo).
  const layout: Kit["layout"] = (arranjo, w) => {
    const pos = def.estacoes[arranjo];
    const { lista, bisnaga, pote, colher, colherOrig, fCost, fMuss, maca } = E;
    Object.keys(lista).forEach((id) => {
      const st = lista[id];
      const [x, z] = pos[id];
      st.raiz.position.set(x, MESA, z);
      st.anel.position.set(x, MESA + 0.0015, z);
    });
    lista.pasta.raiz.add(bisnaga);
    pote.rotation.y = -0.7;
    lista.creme.raiz.add(pote);
    colherOrig.pai.add(colher); colher.position.copy(colherOrig.p); colher.quaternion.copy(colherOrig.q); colher.scale.setScalar(1);
    fCost.position.set(0, 0.075, 0); lista[idRecheio].raiz.add(fCost);
    fMuss.position.set(0, 0.052, 0); lista.mussarela.raiz.add(fMuss);
    lista.macarico.raiz.add(maca);
    // casa = pose no mundo; a ferramenta passa a viver solta no grupo do mundo
    soltarNoMundo(lista, w);
    // Casas pensadas para a pegada: a raiz da mão na pegada é casa * (ferramenta na mão)^-1, então cada
    // ferramenta fica parada numa pose em que a mão chega em pé, do lado direito, sem virar.
    {
      // bisnaga: na mão ela já fica de bico para baixo; no suporte, o bico entra no copo
      const r = lista.pasta.raiz.position;
      porParaPegar(bisnaga, OBJ.bisnaga, qBase("mao_bisnaga"), new Vector3(...POSES.mao_bisnaga.ponto), new Vector3(r.x, MESA + 0.016, r.z));
    }
    {
      // maçarico: no coldre de bico para baixo, inclinado ~10° (a mão vem de cima e gira para a pose de uso no caminho)
      const qb = qBase("mao_macarico");
      const d = CHAMA_DIR.clone().applyQuaternion(qb);
      const qc = new Quaternion().slerp(new Quaternion().setFromUnitVectors(d, new Vector3(0, -1, 0)), 0.82);
      const r = lista.macarico.raiz.position;
      porParaPegar(maca, OBJ.macarico, qc.multiply(qb), new Vector3(...POSES.mao_macarico.ponto), new Vector3(r.x, MESA + 0.024, r.z));
    }
    {
      // colher: continua apoiada no pote como no modelo, só girada em volta do eixo do pote para o cabo
      // ficar do lado de onde a mão vem
      const qG0 = colher.quaternion.clone().multiply(OBJ.colher.q.clone().invert());
      const qd = qBase("mao_colher").multiply(qG0.invert());
      const psi = 2 * Math.atan2(qd.y, qd.w);
      const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), psi);
      const c = lista.creme.raiz.position;
      colher.position.sub(c).applyQuaternion(qy).add(c);
      colher.quaternion.premultiply(qy);
    }
    {
      // punhados: o monte não tem frente, então a mão pega girada para o braço ir para a direita e para o
      // fundo (sem atravessar a frente da cena); no caminho ela gira de volta para a pose de uso
      const qb = qBase("mao_punhado");
      const bw = new Vector3(...POSES.mao_punhado.braco).applyQuaternion(qb);
      const psi = MathUtils.degToRad(40) - Math.atan2(-bw.z, bw.x);
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), psi).multiply(qb);
      fCost.quaternion.copy(q); fMuss.quaternion.copy(q);
    }
    guardarCasas(lista);
    return () => devolverAsRaizes(lista, w);
  };

  const final = (id: string) => {
    FX.fio.visible = false; FX.brilho.visible = false; FX.luz.intensity = 0; FX.ralada.visible = false; FX.quedas.forEach((q2) => { q2.visible = false; });
    F.chama.visible = false;
    if (id === "pasta") { L.pasta.visible = true; L.clip.pasta.constant = 1; }
    if (id === "creme") { L.creme.visible = true; L.clip.creme.constant = 1; }
    if (id === idRecheio) L.partes.forEach((p) => { p.visible = true; p.scale.set(1, 1, 1); });
    if (id === "tampa") L.tampa.rotation.x = 0;
    if (id === "mussarela") { L.mussPiv.visible = true; L.mussPiv.scale.set(1, 1, 1); L.clip.muss.constant = 1; }
    if (id === "macarico") { L.gratinado.visible = true; L.clip.grat.constant = 1; }
  };
  const zerar = () => {
    L.pasta.visible = false; L.creme.visible = false; L.mussPiv.visible = false; L.gratinado.visible = false;
    L.partes.forEach((p) => { p.visible = false; p.scale.set(1, 0.001, 1); });
    L.tampa.rotation.x = OPEN;
    Object.values(L.clip).forEach((c) => { c.constant = -1; });
    L.lanche.scale.set(1, 1, 1);
    FX.fio.visible = false; FX.quedas.forEach((q) => { q.visible = false; }); FX.ralada.visible = false; FX.brilho.visible = false; FX.luz.intensity = 0;
  };

  // ------------------------------------------------ efeitos de cada ação
  const fxTmp = { a: new Vector3(), b: new Vector3(), q: new Quaternion(), m: new Matrix4(), s: new Vector3(), e: new Euler() };
  const efeitos: Kit["efeitos"] = (id, t, amp, red, c) => {
    const H = { raiz: c.mao };
    if (id === "pasta") {
      const [a, b] = PASTA.varre;
      const u = seg(t, a, b);
      const bico = pastaBico(u, M, fxTmp.a);
      L.clip.pasta.constant = t < a ? -1 : t < b ? bico.x - 0.003 : 1;
      // fio saindo do bico
      const on = t > a - 0.02 && t < b + 0.03;
      FX.fio.visible = on;
      if (on) {
        // ponta real do bico (a mão pode estar inclinada)
        const tip = fxTmp.b.set(...POSES.mao_bisnaga.ponto).applyQuaternion(H.raiz.quaternion).add(H.raiz.position);
        const chao = M.pasta - 0.004;
        const alvo = fxTmp.a.set(tip.x - c.lean.x * 0.025, chao, tip.z - c.lean.z * 0.025);
        const dir = alvo.clone().sub(tip);
        FX.fio.position.copy(tip);
        FX.fio.quaternion.setFromUnitVectors(fxTmp.s.set(0, -1, 0), dir.clone().normalize());
        const fino = t > b ? 1 - seg(t, b, b + 0.03) : seg(t, a - 0.02, a + 0.04);
        FX.fio.scale.set(fino, dir.length(), fino);
      }
      // bisnaga apertada: encolhe um pouco
      const sq = seg(t, a - 0.08, a + 0.02) * (1 - seg(t, b, b + 0.12));
      const wob = red ? 0 : 0.015 * Math.sin(t * 40) * sq;
      F.fer.pasta!.scale.set(1 - 0.09 * sq + wob, 1 + 0.03 * sq, 1 - 0.09 * sq - wob);
    } else if (id === "creme") {
      const [a, b] = CREME.varre;
      const u = seg(t, a, b);
      let mx = -1;
      if (t >= a) for (let i = 0; i <= 24; i++) { const ui = (u * i) / 24; mx = Math.max(mx, cremeConcha(ui, M, fxTmp.a).x); }
      L.clip.creme.constant = t < a ? -1 : t < b ? mx + 0.012 : 1;
    } else if (id === idRecheio) {
      const { xs, solta, queda } = COSTELA;
      solta.forEach((s, i) => {
        const q = FX.quedas[i];
        const parte = L.partes[i];
        const x = xs[i], topo = M.costela - 0.012;
        if (t < s) { q.visible = false; parte.visible = false; parte.scale.set(1, 0.001, 1); return; }
        const tq = t - s;
        // cai, achata e some dentro da camada que cresce
        const y0 = M.costela + 0.085;
        if (tq < queda) {
          const k = tq / queda;
          q.visible = true;
          q.position.set(x, lerp(y0 - 0.006, topo, k * k), 0.004 * (i - 1));
          const st = red ? 0 : 0.35 * k * k;
          q.scale.set(1 - st * 0.4, 1 + st, 1 - st * 0.4);
        } else {
          const k = seg(tq, queda, queda + 0.16);
          q.visible = k < 1;
          const sq = red ? 0 : 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.4));
          q.position.set(x, topo - 0.01 * k, 0.004 * (i - 1));
          q.scale.set((1 + sq) * (1 - k * 0.8), (1 - sq) * (1 - k * 0.9), (1 + sq) * (1 - k * 0.8));
        }
        // camada: cresce com mola (squash and stretch)
        const g = seg(tq, queda * 0.6, queda + 0.42);
        parte.visible = g > 0;
        const y = Math.max(0.001, amp ? mola(g, 1) : eOut3(g));
        const lat = red ? 1 : 1 + 0.12 * (1 - y) * (g > 0 ? 1 : 0);
        parte.scale.set(lat, y, lat);
      });
      // o punhado na mão diminui a cada soltura
      const saiu = solta.reduce((s, si) => s + seg(t, si, si + 0.08), 0);
      F.fer[idRecheio]!.scale.setScalar(Math.max(0.001, 1 - saiu / 3));
    } else if (id === "tampa") {
      L.tampa.rotation.x = anguloTampa(t, amp);
      const [a, b] = TAMPA.aperta;
      const p = pulso(t, a, b) * (amp ? 1 : 0.4);
      L.lanche.scale.set(1 + 0.02 * p, 1 - 0.055 * p, 1 + 0.02 * p);
      if (t > b) { const k = seg(t, b, b + 0.4); const e = amp ? 1 + 0.03 * Math.sin(Math.PI * k * 2) * (1 - k) : 1; L.lanche.scale.set(1, e, 1); }
    } else if (id === "mussarela") {
      const ac = ACOES.mussarela;
      const [a, b] = MUSS.varre;
      L.mussPiv.visible = t > a + 0.12;
      const u = seg(t, a, b);
      const hx = lerp(MUSS.x0, MUSS.x1, u);
      L.clip.muss.constant = t < a + 0.1 ? -1 : t < b + 0.2 ? hx - 0.01 + seg(t, b, b + 0.2) * 0.4 : 1;
      // derrete: começa alta e "escorre" até assentar
      const k = seg(t, a + 0.1, ac.D - 0.05);
      const y = amp ? 1 + 0.6 * (1 - mola(k, 0.9)) : 1 + 0.6 * (1 - eOut3(k));
      L.mussPiv.scale.set(1 - 0.04 * (y - 1), y, 1 - 0.04 * (y - 1));
      // fiapos caindo
      FX.ralada.visible = t > a && t < b + 0.45;
      const solta = new Vector3(...POSES.mao_punhado.ponto).applyQuaternion(H.raiz.quaternion).add(H.raiz.position);
      for (let i = 0; i < FX.N; i++) {
        const [r0, r1, r2, r3, r4] = FX.sem[i];
        const nasce = a + (b - a) * r0;
        const vida = t - nasce;
        const fall = 0.2;
        let esc = 0;
        const p = fxTmp.a;
        if (vida > 0) {
          const xi = lerp(MUSS.x0, MUSS.x1, r0) + (r1 - 0.5) * 0.03;
          const zi = (r2 - 0.5) * 0.06;
          const yi = M.muss + 0.06;
          const k = c01(vida / fall);
          p.set(xi, lerp(yi, M.muss - 0.002, k * k), zi);
          if (vida < 0.02) p.lerp(solta, 1 - vida / 0.02);
          esc = vida < fall ? 1 : 1 - c01((vida - fall) / 0.25);
        }
        fxTmp.q.setFromEuler(fxTmp.e.set(r3 * 3, r4 * 3, (r3 + r4) * 2));
        fxTmp.m.compose(p, fxTmp.q, fxTmp.s.setScalar(Math.max(0.0001, esc)));
        FX.ralada.setMatrixAt(i, fxTmp.m);
      }
      FX.ralada.instanceMatrix.needsUpdate = true;
      const fm = F.fer.mussarela!;
      fm.scale.setScalar(Math.max(0.001, 1 - 0.85 * u));
    } else if (id === "macarico") {
      const [a, b] = MACA.varre;
      const on = t > a - 0.06 && t < b + 0.02;
      F.chama.visible = on;
      const tip = fxTmp.a.set(...POSES.mao_macarico.ponto).applyQuaternion(H.raiz.quaternion).add(H.raiz.position);
      const dir = fxTmp.b.copy(CHAMA_DIR).applyQuaternion(H.raiz.quaternion);
      const hit = tip.clone().addScaledVector(dir, MACA.alcance);
      if (on && !red) F.chama.scale.setScalar(0.94 + 0.12 * Math.abs(Math.sin(t * 37) * Math.cos(t * 23)));
      L.gratinado.visible = t >= a;
      L.clip.grat.constant = t < a ? -1 : t < b ? hit.x - 0.006 : 1;
      const brilhoK = on ? 1 : t >= b ? 1 - seg(t, b, b + 0.35) : 0;
      FX.brilho.visible = brilhoK > 0;
      FX.brilho.position.set(hit.x, M.muss + 0.004, hit.z);
      (FX.brilho.material as MeshBasicMaterial).opacity = brilhoK * (0.75 + (red ? 0 : 0.25 * Math.sin(t * 31)));
      FX.brilho.scale.setScalar(0.1 + 0.015 * Math.sin(t * 17));
      FX.luz.position.set(hit.x, M.muss + 0.03, hit.z + 0.01);
      FX.luz.intensity = brilhoK * (0.9 + (red ? 0 : 0.3 * Math.sin(t * 29)));
    }
  };

  const acoes = Object.fromEntries(def.passos.map((p) => [p.id, ACOES[p.tipo as keyof typeof ACOES]]));

  return {
    raiz: L.raiz, lanche: L.lanche,
    extras: [FX.fio, ...FX.quedas, FX.ralada, FX.brilho, FX.luz],
    estacoes: E.lista, fer: F.fer, acoes,
    caixa: { x: [-0.16, 0.16], y: [0, 0.11], z: [-0.07, 0.07] },
    naTabua: new Vector3(0.15, 0, 0.1),
    anel: [0.5, 0.26],
    layout, zerar, final,
    reiniciar: () => {
      Object.values(E.lista).forEach((st) => {
        const f = st.ferramenta;
        if (f) { f.position.copy(st.casa.p); f.quaternion.copy(st.casa.q); f.scale.setScalar(1); f.visible = true; }
      });
    },
    inicio: (id) => {
      if (id === "pasta") { L.pasta.visible = true; L.clip.pasta.constant = -1; }
      if (id === "creme") { L.creme.visible = true; L.clip.creme.constant = -1; }
    },
    efeitos,
    quadro: () => {
      const g = L.partes.reduce((s, p) => s + (p.visible ? Math.min(1, p.scale.y) : 0), 0) / 3;
      L.creme.position.y = -L.cremeDy * (1 - g);
    },
    M,
  };
}
