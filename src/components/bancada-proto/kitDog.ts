// Kit do Dogalho: brioche numa cestinha na tábua, sem maçarico. Pasta de alho (bisnaga), salsichas (uma de cada vez,
// da travessa), ketchup e mostarda (duas bisnagas tingidas), tampa do brioche, fundue (colher num caquelon),
// mussarela e batata palha (punhados). Contrato dos GLBs: blender/bancada3d/README.md, seção "Dogalho".
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Group, InstancedMesh, LatheGeometry, Matrix4, Mesh,
  MeshStandardMaterial, Object3D, Quaternion, Vector2, Vector3, type Material,
} from "three";
import { OPEN, c01, eIOs, eOut3, lerp, mola, pulso, seg, type Medidas } from "./acoes";
import { ACOES_DOG, DMUSS, DOG_TAMPA, DPASTA, FONDUE, MOLHOS, PALHA, SALS, anguloTampaDog, dpastaBico, fondueConcha, molhoBico } from "./acoesDog";
import {
  OBJ, POSES, anelTextura, caixa, clipar, clonar, devolverAsRaizes, fazerEstacao, fiapos, guardarCasas, mats, planoX, pontoNoMundo, porParaPegar,
  qBase, separar, soltarNoMundo, tigela, type Estacao, type Kit, type Volta,
} from "./kit";
import { MESA, type LancheDef } from "./layout";

const KETCHUP = "#c8221a", MOSTARDA = "#f4c232";
const PALHA_CORES = ["#e09a2c", "#eab04a", "#d4881f", "#f2c05a", "#b8741c"];
const MUSS_CORES = ["#f3dc98", "#f6e4ae", "#ecd085"];

const malhaDe = (o: Object3D) => { let m: Mesh | null = null; o.traverse((n) => { if (!m && n instanceof Mesh) m = n; }); return m as unknown as Mesh; };
/** Malha nova com parte da geometria, recentrada (a posição do objeto fica no centro da peça). */
function pedaco(base: Mesh, geo: BufferGeometry) {
  geo.computeBoundingBox();
  const c = new Vector3(); geo.boundingBox!.getCenter(c);
  geo.translate(-c.x, -c.y, -c.z);
  const m = new Mesh(geo, (Array.isArray(base.material) ? base.material[0] : base.material).clone());
  m.castShadow = true; m.receiveShadow = true;
  m.position.copy(c);
  return m;
}
/** Tinge os materiais de `o` cujo nome contém `nome` (multiplica a cor de vértice). */
const tingir = (o: Object3D, nome: string, cor: string) => mats(o).forEach((m) => { if (m.name.includes(nome) && m instanceof MeshStandardMaterial) m.color.set(cor); });

export function kitDog(def: LancheDef, A: Record<string, Object3D>, M: Medidas): Kit {
  // ------------------------------------------------ lanche
  const L = (() => {
    const raiz = new Group();
    const tabua = clonar(A.tabua);
    const cesta = clonar(A["dog-cesta"]);
    const lanche = new Group();
    const brioche = clonar(A["dog-brioche"]);
    const tampa = brioche.getObjectByName("dog_brioche_tampa")!;
    const clip = { pasta: planoX(), ketchup: planoX(), mostarda: planoX(), fondue: planoX(), muss: planoX(), palha: planoX() };
    const pasta = clonar(A["dog-pasta"]); clipar(pasta, [clip.pasta]);
    // dog-salsichas é uma malha só com as duas salsichas lado a lado: separa pelo lado (z) de cada triângulo
    const ms = malhaDe(A["dog-salsichas"]); ms.updateWorldMatrix(true, false);
    const gs = ms.geometry.clone().applyMatrix4(ms.matrixWorld);
    const ladoZ = (s: BufferGeometry, i: number) => { const p = s.attributes.position; return p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2); };
    const salsA = pedaco(ms, separar(gs, (s, i) => ladoZ(s, i) < 0));
    const salsB = pedaco(ms, separar(gs, (s, i) => ladoZ(s, i) >= 0));
    // dog-molhos: ketchup e mostarda numa malha só, com a cor no vértice: separa pela cor (vermelho x amarelo)
    const mm = malhaDe(A["dog-molhos"]); mm.updateWorldMatrix(true, false);
    const gm = mm.geometry.clone().applyMatrix4(mm.matrixWorld);
    const verde = (s: BufferGeometry, i: number) => { const c = s.attributes.color; if (!c) return 1; return (c.getY(i) + c.getY(i + 1) + c.getY(i + 2)) / Math.max(1e-4, c.getX(i) + c.getX(i + 1) + c.getX(i + 2)); };
    const ketchup = new Mesh(separar(gm, (s, i) => verde(s, i) < 0.3), (mm.material as Material).clone());
    const mostarda = new Mesh(separar(gm, (s, i) => verde(s, i) >= 0.3), (mm.material as Material).clone());
    [ketchup, mostarda].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
    clipar(ketchup, [clip.ketchup]); clipar(mostarda, [clip.mostarda]);
    // fundue escorre: pivô no topo, as línguas crescem para baixo
    const fondue = clonar(A["dog-fondue"]); clipar(fondue, [clip.fondue]);
    const bf = caixa(fondue);
    const fonduePiv = new Group(); fonduePiv.position.y = bf.max.y; fondue.position.y = -bf.max.y; fonduePiv.add(fondue);
    // mussarela derrete (pivô perto da base, como no pão de alho)
    const muss = clonar(A["dog-mussarela"]); clipar(muss, [clip.muss]);
    const bm = caixa(muss);
    const mussPiv = new Group(); mussPiv.position.y = bm.min.y + 0.01; muss.position.y = -(bm.min.y + 0.01); mussPiv.add(muss);
    // batata palha assenta (pivô na base)
    const palha = clonar(A["dog-palha"]); clipar(palha, [clip.palha]);
    const bp = caixa(palha);
    const palhaPiv = new Group(); palhaPiv.position.y = bp.min.y; palha.position.y = -bp.min.y; palhaPiv.add(palha);
    lanche.add(brioche, pasta, salsA, salsB, ketchup, mostarda, fonduePiv, mussPiv, palhaPiv);
    raiz.add(tabua, cesta, lanche);
    // medidas
    M.h.pasta = caixa(pasta).max.y;
    M.h.molhos = caixa(mostarda).max.y;
    M.h.fondue = bf.max.y - 0.004;
    M.h.muss = bm.max.y - 0.006;
    M.h.palha = bp.max.y - 0.012;
    M.p.salsA = salsA.position.clone();
    M.p.salsB = salsB.position.clone();
    return { raiz, lanche, tampa, pasta, salsA, salsB, ketchup, mostarda, fonduePiv, mussPiv, palhaPiv, clip, geoA: salsA.geometry, geoB: salsB.geometry, matS: salsA.material };
  })();

  // ------------------------------------------------ estações
  const E = (() => {
    const anelTex = anelTextura();
    const metal = new MeshStandardMaterial({ color: "#2a2624", roughness: 0.3, metalness: 0.85 });
    const suporte = () => {
      const s = new Mesh(new LatheGeometry([[0, 0], [0.048, 0], [0.048, 0.006], [0.037, 0.01], [0.037, 0.058], [0.0325, 0.058], [0.0325, 0.012], [0, 0.012]].map(([x, y]) => new Vector2(x, y)), 36), metal);
      s.castShadow = true; s.receiveShadow = true;
      return s;
    };
    // pasta: bisnaga de bico para baixo no suporte
    const bis = new Group(); bis.add(suporte());
    const bisnaga = clonar(A.bisnaga);
    // salsichas: travessa oval com as duas, deitadas ao comprido (eixo z da travessa)
    const tv = new Group();
    const prato = new Mesh(new LatheGeometry([[0, 0], [0.04, 0], [0.046, 0.002], [0.05, 0.008], [0.0485, 0.0095], [0.044, 0.005], [0, 0.005]].map(([x, y]) => new Vector2(x, y)), 40),
      new MeshStandardMaterial({ color: "#ece5d8", roughness: 0.35 }));
    prato.scale.set(1, 1, 2.95); prato.castShadow = true; prato.receiveShadow = true; tv.add(prato);
    const salsT = (geo: BufferGeometry) => { const m = new Mesh(geo, (L.matS as Material).clone()); m.castShadow = true; m.receiveShadow = true; return m; };
    const bandA = salsT(L.geoA), bandB = salsT(L.geoB);
    // molhos: duas bisnagas (corpo tingido) num suporte duplo
    const ms = new Group();
    const s1 = suporte(), s2 = suporte(); s1.position.x = -0.036; s2.position.x = 0.036; s1.scale.set(0.92, 1, 0.92); s2.scale.set(0.92, 1, 0.92); ms.add(s1, s2);
    const bVerm = clonar(A.bisnaga); tingir(bVerm, "corpo", KETCHUP);
    const bAmar = clonar(A.bisnaga); tingir(bAmar, "corpo", MOSTARDA);
    // fundue: o pote do creme vira um caquelon (cerâmica vermelho-escura, queijo dourado)
    const pf = new Group(); const pote = clonar(A["pote-creme"]);
    tingir(pote, "ceramica", "#8a3220"); tingir(pote, "creme_pote", "#f2c14e");
    const colher = pote.getObjectByName("colher")!;
    const colherOrig = { pai: colher.parent!, p: colher.position.clone(), q: colher.quaternion.clone() };
    pf.add(pote);
    // mussarela ralada numa tigela de barro
    const pm = new Group();
    pm.add(tigela(0.07, 0.048, "#8c4a2b"));
    const ralada = new Mesh(fiapos(260, 0.058, MUSS_CORES, 0.016, 0.0028, 5), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    ralada.position.y = 0.034; ralada.scale.set(1, 0.42, 1); pm.add(ralada);
    const fMuss = new Mesh(fiapos(60, 0.022, MUSS_CORES, 0.016, 0.003, 9), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    fMuss.castShadow = true;
    // batata palha numa tigela clara
    const pp = new Group();
    pp.add(tigela(0.068, 0.044, "#e6ddcd"));
    const monte = new Mesh(fiapos(320, 0.056, PALHA_CORES, 0.02, 0.0018, 21), new MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));
    monte.position.y = 0.032; monte.scale.set(1, 0.45, 1); pp.add(monte);
    const fPalha = new Mesh(fiapos(80, 0.022, PALHA_CORES, 0.02, 0.0019, 17), new MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));
    fPalha.castShadow = true;

    const lista: Record<string, Estacao> = {
      "dog-pasta": fazerEstacao("dog-pasta", bis, bisnaga, 0.04, 0.19, anelTex),
      "dog-salsichas": fazerEstacao("dog-salsichas", tv, bandA, 0.075, 0.04, anelTex, [bandB]),
      "dog-molhos": fazerEstacao("dog-molhos", ms, bVerm, 0.07, 0.19, anelTex, [bAmar]),
      "dog-fondue": fazerEstacao("dog-fondue", pf, colher, 0.066, 0.08, anelTex),
      "dog-mussarela": fazerEstacao("dog-mussarela", pm, fMuss, 0.072, 0.06, anelTex),
      "dog-palha": fazerEstacao("dog-palha", pp, fPalha, 0.07, 0.06, anelTex),
    };
    lista["dog-salsichas"].alonga = 1.9;
    return { lista, bisnaga, tv, bandA, bandB, bVerm, bAmar, pote, colher, colherOrig, fMuss, fPalha, amarCasa: { p: new Vector3(), q: new Quaternion() } };
  })();

  // ------------------------------------------------ ferramentas na mão (no espaço da raiz da mão)
  const F = (() => {
    const bis = clonar(A.bisnaga); bis.position.copy(OBJ.bisnaga.p); bis.quaternion.copy(OBJ.bisnaga.q);
    const molho = clonar(A.bisnaga); molho.position.copy(OBJ.bisnaga.p); molho.quaternion.copy(OBJ.bisnaga.q);
    const corpoMolho = mats(molho).filter((m) => m.name.includes("corpo")) as MeshStandardMaterial[];
    const pote2 = clonar(A["pote-creme"]);
    const col = pote2.getObjectByName("colher")!; col.removeFromParent(); col.position.copy(OBJ.colher.p); col.quaternion.copy(OBJ.colher.q);
    const solta = new Vector3(...POSES.mao_punhado.ponto);
    const muss = E.fMuss.clone(); muss.position.copy(solta).add(new Vector3(0, 0.01, 0));
    const palha = E.fPalha.clone(); palha.position.copy(solta).add(new Vector3(0, 0.01, 0));
    // salsichas: a mão não leva uma cópia; a própria salsicha do lanche segue o ponto da mão. Este nó vazio só
    // define a pegada (calculado no layout, porque depende do giro da travessa).
    const salsichas = new Object3D();
    const fer: Record<string, Object3D | null> = { "dog-pasta": bis, "dog-salsichas": salsichas, "dog-molhos": molho, tampa: null, "dog-fondue": col, "dog-mussarela": muss, "dog-palha": palha };
    return { fer, corpoMolho };
  })();

  // ------------------------------------------------ efeitos
  const FX = (() => {
    const fio = new Mesh(new CylinderGeometry(0.0021, 0.0032, 1, 10, 1, true).translate(0, -0.5, 0), new MeshStandardMaterial({ color: "#f2e7c8", roughness: 0.32 }));
    fio.visible = false;
    const N = 70;
    const ralada = new InstancedMesh(new BoxGeometry(0.003, 0.003, 0.016), new MeshStandardMaterial({ color: "#f3dc98", roughness: 0.5 }), N);
    const palha = new InstancedMesh(new BoxGeometry(0.0019, 0.0019, 0.021), new MeshStandardMaterial({ color: "#ffffff", roughness: 0.45 }), N);
    const cor = new Color();
    [ralada, palha].forEach((m) => { m.visible = false; m.frustumCulled = false; });
    const sem: number[][] = [];
    let s = 3; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) { sem.push([rnd(), rnd(), rnd(), rnd(), rnd()]); palha.setColorAt(i, cor.set(PALHA_CORES[i % PALHA_CORES.length])); }
    return { fio, ralada, palha, sem, N };
  })();

  // ------------------------------------------------ layout das estações
  const giroSals = { v: 0 };
  const layout: Kit["layout"] = (arranjo, w) => {
    const pos = def.estacoes[arranjo];
    const { lista, bisnaga, tv, bandA, bandB, bVerm, bAmar, pote, colher, colherOrig, fMuss, fPalha, amarCasa } = E;
    Object.keys(lista).forEach((id) => {
      const st = lista[id];
      const [x, z, giro = 0] = pos[id];
      st.raiz.position.set(x, MESA, z); st.raiz.rotation.set(0, giro, 0);
      st.anel.position.set(x, MESA + 0.0015, z); st.anel.rotation.set(-Math.PI / 2, 0, giro);
    });
    lista["dog-pasta"].raiz.add(bisnaga);
    // travessa: as salsichas ao comprido, lado a lado
    const yT = 0.0062 + 0.0136;
    bandA.position.set(-0.0185, yT, 0); bandA.rotation.set(0, Math.PI / 2, 0); bandA.scale.setScalar(1); tv.add(bandA);
    bandB.position.set(0.0185, yT, 0); bandB.rotation.set(0, Math.PI / 2, 0); bandB.scale.setScalar(1); tv.add(bandB);
    lista["dog-molhos"].raiz.add(bVerm);
    pote.rotation.y = -0.7;
    lista["dog-fondue"].raiz.add(pote);
    colherOrig.pai.add(colher); colher.position.copy(colherOrig.p); colher.quaternion.copy(colherOrig.q); colher.scale.setScalar(1);
    fMuss.position.set(0, 0.052, 0); lista["dog-mussarela"].raiz.add(fMuss);
    fPalha.position.set(0, 0.05, 0); lista["dog-palha"].raiz.add(fPalha);
    soltarNoMundo(lista, w);
    {
      const r = lista["dog-pasta"].raiz.position;
      porParaPegar(bisnaga, OBJ.bisnaga, qBase("mao_bisnaga"), new Vector3(...POSES.mao_bisnaga.ponto), new Vector3(r.x, MESA + 0.016, r.z));
    }
    {
      // ketchup à esquerda, mostarda à direita, cada uma no seu copo; a mão pega as duas na pose de uso
      const r = lista["dog-molhos"].raiz;
      r.updateMatrixWorld(true);
      const pk = new Vector3(-0.036, 0, 0).applyMatrix4(r.matrixWorld), pa = new Vector3(0.036, 0, 0).applyMatrix4(r.matrixWorld);
      M.p.ketchup = new Vector3(pk.x, MESA + 0.016, pk.z);
      M.p.mostarda = new Vector3(pa.x, MESA + 0.016, pa.z);
      const ponto = new Vector3(...POSES.mao_bisnaga.ponto);
      porParaPegar(bVerm, OBJ.bisnaga, qBase("mao_bisnaga"), ponto, M.p.ketchup);
      porParaPegar(bAmar, OBJ.bisnaga, qBase("mao_bisnaga"), ponto, M.p.mostarda);
      bAmar.scale.setScalar(1); bAmar.visible = true;
      if (bAmar.parent !== w) w?.add(bAmar);
      amarCasa.p.copy(bAmar.position); amarCasa.q.copy(bAmar.quaternion);
    }
    {
      const qG0 = colher.quaternion.clone().multiply(OBJ.colher.q.clone().invert());
      const qd = qBase("mao_colher").multiply(qG0.invert());
      const psi = 2 * Math.atan2(qd.y, qd.w);
      const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), psi);
      const c = lista["dog-fondue"].raiz.position;
      colher.position.sub(c).applyQuaternion(qy).add(c);
      colher.quaternion.premultiply(qy);
    }
    {
      // punhados: a mão pega girada (braço para a direita e para o fundo), como no pão de alho
      const qb = qBase("mao_punhado");
      const bw = new Vector3(...POSES.mao_punhado.braco).applyQuaternion(qb);
      const psi = (40 * Math.PI) / 180 - Math.atan2(-bw.z, bw.x);
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), psi).multiply(qb);
      fMuss.quaternion.copy(q); fPalha.quaternion.copy(q);
    }
    guardarCasas(lista);
    {
      // salsichas: a mão pega na pose de uso (sem giro), com o ponto de soltura logo acima do centro da salsicha
      const st = lista["dog-salsichas"];
      const qb = qBase("mao_punhado"), qi = qb.clone().invert();
      const d = F.fer["dog-salsichas"]!;
      d.quaternion.copy(qi).multiply(st.casa.q);
      d.position.set(...POSES.mao_punhado.ponto).sub(new Vector3(0, SALS.grip, 0).applyQuaternion(qi));
      tv.updateMatrixWorld(true);
      M.p.bandejaB = bandB.getWorldPosition(new Vector3());
      // giro da salsicha na travessa, no intervalo (-90°, 90°] (a salsicha é quase simétrica)
      let g = new Euler().setFromQuaternion(st.casa.q, "YXZ").y;
      while (g > Math.PI / 2) g -= Math.PI;
      while (g <= -Math.PI / 2) g += Math.PI;
      giroSals.v = g;
    }
    return () => devolverAsRaizes(lista, w);
  };

  const apagarFX = () => { FX.fio.visible = false; FX.ralada.visible = false; FX.palha.visible = false; };
  const final = (id: string): Volta[] | void => {
    apagarFX();
    if (id === "dog-pasta") { L.pasta.visible = true; L.clip.pasta.constant = 1; }
    if (id === "dog-salsichas") {
      [[L.salsA, M.p.salsA], [L.salsB, M.p.salsB]].forEach(([o, p]) => { const s = o as Mesh; s.visible = true; s.position.copy(p as Vector3); s.rotation.set(0, 0, 0); s.scale.setScalar(1); });
      E.bandB.visible = false;
    }
    if (id === "dog-molhos") {
      L.ketchup.visible = true; L.mostarda.visible = true; L.clip.ketchup.constant = 1; L.clip.mostarda.constant = 1;
      F.corpoMolho.forEach((m) => m.color.set(KETCHUP));
      return [{ obj: E.bAmar, p: E.amarCasa.p, q: E.amarCasa.q }];
    }
    if (id === "tampa") L.tampa.rotation.x = 0;
    if (id === "dog-fondue") { L.fonduePiv.visible = true; L.fonduePiv.scale.set(1, 1, 1); L.clip.fondue.constant = 1; }
    if (id === "dog-mussarela") { L.mussPiv.visible = true; L.mussPiv.scale.set(1, 1, 1); L.clip.muss.constant = 1; }
    if (id === "dog-palha") { L.palhaPiv.visible = true; L.palhaPiv.scale.set(1, 1, 1); L.clip.palha.constant = 1; }
  };
  const zerar = () => {
    [L.pasta, L.salsA, L.salsB, L.ketchup, L.mostarda, L.fonduePiv, L.mussPiv, L.palhaPiv].forEach((o) => { o.visible = false; });
    L.tampa.rotation.x = OPEN;
    Object.values(L.clip).forEach((c) => { c.constant = -1; });
    L.lanche.scale.set(1, 1, 1);
    E.bandB.visible = true;
    E.bAmar.visible = true; E.bAmar.scale.setScalar(1); E.bAmar.position.copy(E.amarCasa.p); E.bAmar.quaternion.copy(E.amarCasa.q);
    F.corpoMolho.forEach((m) => m.color.set(KETCHUP));
    apagarFX();
  };

  // ------------------------------------------------ efeitos de cada ação
  const fx = { a: new Vector3(), b: new Vector3(), c: new Vector3(), q: new Quaternion(), m: new Matrix4(), s: new Vector3(), e: new Euler() };
  /** Fio saindo do bico da bisnaga até `chao`. */
  function fio(t: number, a: number, b: number, chao: number, c: { mao: Object3D; lean: Vector3 }) {
    const on = t > a - 0.02 && t < b + 0.03;
    if (!on) return false;
    FX.fio.visible = true;
    const tip = pontoNoMundo("mao_bisnaga", c.mao, fx.b);
    const alvo = fx.a.set(tip.x - c.lean.x * 0.025, chao, tip.z - c.lean.z * 0.025);
    const dir = alvo.clone().sub(tip);
    FX.fio.position.copy(tip);
    FX.fio.quaternion.setFromUnitVectors(fx.s.set(0, -1, 0), dir.clone().normalize());
    const fino = t > b ? 1 - seg(t, b, b + 0.03) : seg(t, a - 0.02, a + 0.04);
    FX.fio.scale.set(fino, Math.max(0.001, dir.length()), fino);
    return true;
  }
  /** Bisnaga apertada: encolhe um pouco enquanto sai o fio. */
  function aperta(f: Object3D, t: number, a: number, b: number, red: boolean) {
    const sq = seg(t, a - 0.08, a + 0.02) * (1 - seg(t, b, b + 0.12));
    const wob = red ? 0 : 0.015 * Math.sin(t * 40) * sq;
    f.scale.set(1 - 0.09 * sq + wob, 1 + 0.03 * sq, 1 - 0.09 * sq - wob);
  }
  /** Punhado que cai em fiapos e revela a camada (mussarela, batata palha). */
  function chuva(inst: InstancedMesh, t: number, a: number, b: number, x0: number, x1: number, h: number, mao: Object3D) {
    inst.visible = t > a && t < b + 0.45;
    const solta = pontoNoMundo("mao_punhado", mao, fx.c);
    for (let i = 0; i < FX.N; i++) {
      const [r0, r1, r2, r3, r4] = FX.sem[i];
      const vida = t - (a + (b - a) * r0);
      const fall = 0.2;
      let esc = 0;
      const p = fx.a.set(0, -1, 0);
      if (vida > 0) {
        const k = c01(vida / fall);
        p.set(lerp(x0, x1, r0) + (r1 - 0.5) * 0.03, lerp(h + 0.06, h - 0.002, k * k), (r2 - 0.5) * 0.055);
        if (vida < 0.02) p.lerp(solta, 1 - vida / 0.02);
        esc = vida < fall ? 1 : 1 - c01((vida - fall) / 0.25);
      }
      fx.q.setFromEuler(fx.e.set(r3 * 3, r4 * 3, (r3 + r4) * 2));
      fx.m.compose(p, fx.q, fx.s.setScalar(Math.max(0.0001, esc)));
      inst.setMatrixAt(i, fx.m);
    }
    inst.instanceMatrix.needsUpdate = true;
  }
  /** Salsicha na mão (segue o ponto de soltura) ou assentando no pão com um quique leve. */
  function naMao(s: Mesh, giro: number, mao: Object3D) {
    s.visible = true;
    pontoNoMundo("mao_punhado", mao, s.position); s.position.y -= SALS.grip;
    s.rotation.set(0, giro, 0); s.scale.setScalar(1);
  }
  function assenta(s: Mesh, base: Vector3, ts: number, amp: number) {
    s.visible = true; s.rotation.set(0, 0, 0);
    const { queda, solta } = SALS;
    if (ts < queda) { const k = ts / queda; s.position.copy(base); s.position.y += solta * (1 - k * k); s.scale.setScalar(1); return; }
    const tb = ts - queda;
    const pulo = amp ? 0.0045 * pulso(tb, 0, 0.14) + 0.0012 * pulso(tb, 0.14, 0.22) : 0;
    const sq = amp ? 0.16 * pulso(tb, 0, 0.06) + 0.06 * pulso(tb, 0.14, 0.18) : 0;
    s.position.copy(base); s.position.y += pulo - 0.0136 * sq;
    s.scale.set(1 + 0.02 * sq, 1 - sq, 1 + 0.06 * sq);
  }

  const efeitos: Kit["efeitos"] = (id, t, amp, red, c) => {
    if (id === "dog-pasta") {
      const [a, b] = DPASTA.varre;
      const bico = dpastaBico(seg(t, a, b), M, fx.c);
      L.clip.pasta.constant = t < a ? -1 : t < b ? bico.x - 0.003 : 1;
      FX.fio.visible = fio(t, a, b, M.h.pasta - 0.004, c);
      aperta(F.fer["dog-pasta"]!, t, a, b, red);
    } else if (id === "dog-salsichas") {
      const { soltaA, pega, chegaB, soltaB } = SALS;
      const g = giroSals.v;
      if (!c.pegou) L.salsA.visible = false;
      else if (t < soltaA) naMao(L.salsA, g * (1 - eIOs(c.leva)), c.mao);
      else assenta(L.salsA, M.p.salsA, t - soltaA, amp);
      if (t < pega[2]) { L.salsB.visible = false; E.bandB.visible = true; }
      else {
        E.bandB.visible = false;
        if (t < soltaB) naMao(L.salsB, g * (1 - eIOs(seg(t, pega[3], chegaB))), c.mao);
        else assenta(L.salsB, M.p.salsB, t - soltaB, amp);
      }
    } else if (id === "dog-molhos") {
      const { k, m, solta, pega } = MOLHOS;
      const mostarda = t >= pega;
      const [a, b] = mostarda ? m : k;
      const bico = molhoBico(seg(t, a, b), M, mostarda ? Math.PI : 0, fx.c);
      L.clip.ketchup.constant = t < k[0] ? -1 : t < k[1] ? bico.x - 0.003 : 1;
      L.clip.mostarda.constant = t < m[0] ? -1 : t < m[1] ? bico.x - 0.003 : 1;
      (FX.fio.material as MeshStandardMaterial).color.set(mostarda ? MOSTARDA : KETCHUP);
      FX.fio.visible = fio(t, a, b, M.h.molhos - 0.006, c);
      const naMaoB = F.fer["dog-molhos"]!;
      aperta(naMaoB, t, a, b, red);
      F.corpoMolho.forEach((mt) => mt.color.set(mostarda ? MOSTARDA : KETCHUP));
      // devolve a vermelha no copo e pega a amarela
      const st = E.lista["dog-molhos"];
      if (t >= solta) { st.ferramenta!.visible = true; st.ferramenta!.position.copy(st.casa.p); st.ferramenta!.quaternion.copy(st.casa.q); st.ferramenta!.scale.setScalar(1); }
      if (t >= solta && t < pega) naMaoB.visible = false;
      E.bAmar.visible = !mostarda;
    } else if (id === "tampa") {
      L.tampa.rotation.x = anguloTampaDog(t, amp);
      const [a, b] = DOG_TAMPA.aperta;
      const p = pulso(t, a, b) * (amp ? 1 : 0.4);
      L.lanche.scale.set(1 + 0.02 * p, 1 - 0.05 * p, 1 + 0.02 * p);
      if (t > b) { const k = seg(t, b, b + 0.4); const e = amp ? 1 + 0.03 * Math.sin(Math.PI * k * 2) * (1 - k) : 1; L.lanche.scale.set(1, e, 1); }
    } else if (id === "dog-fondue") {
      const [a, b] = FONDUE.varre;
      const u = seg(t, a, b);
      let mx = -1;
      if (t >= a) for (let i = 0; i <= 24; i++) mx = Math.max(mx, fondueConcha((u * i) / 24, M, fx.a).x);
      L.clip.fondue.constant = t < a ? -1 : t < b ? mx + 0.014 : 1;
      L.fonduePiv.visible = t >= a;
      // escorre: as línguas crescem para baixo depois que a colher passa
      const k = seg(t, a + 0.15, ACOES_DOG["dog-fondue"].D);
      const y = amp ? 0.4 + 0.6 * mola(k, 0.5) : 0.4 + 0.6 * eOut3(k);
      L.fonduePiv.scale.set(1, y, 1);
    } else if (id === "dog-mussarela") {
      const [a, b] = DMUSS.varre;
      L.mussPiv.visible = t > a + 0.12;
      const u = seg(t, a, b);
      L.clip.muss.constant = t < a + 0.1 ? -1 : t < b + 0.2 ? lerp(DMUSS.x0, DMUSS.x1, u) - 0.01 + seg(t, b, b + 0.2) * 0.4 : 1;
      const k = seg(t, a + 0.1, ACOES_DOG["dog-mussarela"].D - 0.05);
      const y = amp ? 1 + 0.6 * (1 - mola(k, 0.9)) : 1 + 0.6 * (1 - eOut3(k));
      L.mussPiv.scale.set(1 - 0.04 * (y - 1), y, 1 - 0.04 * (y - 1));
      chuva(FX.ralada, t, a, b, DMUSS.x0, DMUSS.x1, M.h.muss, c.mao);
      F.fer["dog-mussarela"]!.scale.setScalar(Math.max(0.001, 1 - 0.85 * u));
    } else if (id === "dog-palha") {
      const [a, b] = PALHA.varre;
      L.palhaPiv.visible = t > a + 0.1;
      const u = seg(t, a, b);
      L.clip.palha.constant = t < a + 0.08 ? -1 : t < b + 0.2 ? lerp(PALHA.x0, PALHA.x1, u) + seg(t, b, b + 0.2) * 0.4 : 1;
      // os fios caem soltos e assentam
      const k = seg(t, a + 0.1, ACOES_DOG["dog-palha"].D - 0.05);
      const y = 1 + 0.35 * (1 - (amp ? mola(k, 0.6) : eOut3(k)));
      L.palhaPiv.scale.set(1, y, 1);
      chuva(FX.palha, t, a, b, PALHA.x0, PALHA.x1, M.h.palha, c.mao);
      F.fer["dog-palha"]!.scale.setScalar(Math.max(0.001, 1 - 0.85 * u));
    }
  };

  // o Turbinar não é ação da mão da montagem (os potinhos são do pedido)
  const acoes = Object.fromEntries(def.passos.filter((p) => p.tipo in ACOES_DOG).map((p) => [p.id, ACOES_DOG[p.tipo as keyof typeof ACOES_DOG]]));

  return {
    raiz: L.raiz, lanche: L.lanche,
    extras: [FX.fio, FX.ralada, FX.palha],
    estacoes: E.lista, fer: F.fer, acoes,
    caixa: { x: [-0.13, 0.13], y: [0, 0.1], z: [-0.07, 0.07] },
    naTabua: new Vector3(0.255, 0, 0.06),
    anel: [0.46, 0.28],
    layout, zerar, final,
    reiniciar: () => {
      Object.values(E.lista).forEach((st) => {
        const f = st.ferramenta;
        if (f) { f.position.copy(st.casa.p); f.quaternion.copy(st.casa.q); f.scale.setScalar(1); f.visible = true; }
      });
    },
    inicio: (id) => {
      if (id === "dog-pasta") { L.pasta.visible = true; L.clip.pasta.constant = -1; (FX.fio.material as MeshStandardMaterial).color.set("#f2e7c8"); }
      if (id === "dog-molhos") { L.ketchup.visible = true; L.mostarda.visible = true; L.clip.ketchup.constant = -1; L.clip.mostarda.constant = -1; }
    },
    efeitos,
    // salsichas e molhos: a ferramenta não volta (a bisnaga vermelha já foi devolvida; as salsichas estão no pão)
    volta: (id) => id !== "dog-salsichas" && id !== "dog-molhos",
    M,
  };
}
