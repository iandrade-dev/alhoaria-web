import { Matrix4, Vector3, type Group, type Mesh, type WebGLRenderer } from "three";

export type EstadoAR = {
  fase: "3d" | "iniciando" | "buscando" | "superficie" | "ajustando" | "colocado";
  rastreando: boolean;
  mensagem: string;
  podeManual: boolean;
  manual: boolean;
  ajusteAltura: number;
  ajusteDistancia: number;
};
export const ESTADO_3D: EstadoAR = { fase: "3d", rastreando: true, mensagem: "Arraste para girar e conhecer o lanche.", podeManual: false, manual: false, ajusteAltura: 0, ajusteDistancia: 0.65 };

/** Um hit-test por sessão. Depois de colocar, novos resultados não movem o pedido. */
export class SessaoMesa {
  private sessao: XRSession | null = null;
  private hit: XRHitTestSource | null = null;
  private referencia: XRReferenceSpace | null = null;
  private geracao = 0;
  private encerrado = false;
  private iniciando = false;
  private colocado = false;
  private superficie = false;
  private rastreando = false;
  private ultimo = "";
  private matriz = new Matrix4();
  private normal = new Vector3();
  private camera = new Vector3();
  private cameraHit = new Vector3();
  private direcao = new Vector3();
  private direcaoHit = new Vector3();
  private matrizViewer = new Matrix4();
  private ultimoHit = -Infinity;
  private temPose = false;
  private manual = false;
  private ajustando = false;
  private baseManual = new Vector3();
  private frenteManual = new Vector3();
  private alturaInicial = 0;
  private ajusteAltura = 0;
  private ajusteDistancia = 0.65;

  constructor(
    private renderer: WebGLRenderer,
    private overlay: HTMLElement,
    private origem: Group,
    private reticulo: Mesh,
    private mudar: (estado: EstadoAR) => void,
    private agora: () => number = () => performance.now(),
  ) {}

  private emitir(fase: EstadoAR["fase"], mensagem: string) {
    const podeManual = !!this.sessao && this.rastreando && this.temPose && !this.colocado;
    const chave = `${fase}/${this.rastreando}/${podeManual}/${this.manual}/${this.ajusteAltura}/${this.ajusteDistancia}/${mensagem}`;
    if (this.encerrado || chave === this.ultimo) return;
    this.ultimo = chave;
    this.mudar({ fase, rastreando: this.rastreando, mensagem, podeManual, manual: this.manual, ajusteAltura: this.ajusteAltura, ajusteDistancia: this.ajusteDistancia });
  }

  async iniciar() {
    if (this.sessao || this.iniciando || this.encerrado) return;
    this.iniciando = true;
    this.origem.visible = false;
    const geracao = ++this.geracao;
    let sessao: XRSession | null = null;
    this.emitir("iniciando", "Abrindo a câmera…");
    try {
      if (!window.isSecureContext || !navigator.xr) throw new Error("indisponivel");
      // Mantém a solicitação no gesto do botão, sem awaits antes da permissão.
      sessao = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["dom-overlay"],
        optionalFeatures: ["hit-test"],
        domOverlay: { root: this.overlay },
      });
      if (this.encerrado || geracao !== this.geracao) { await sessao.end(); return; }
      this.sessao = sessao;
      sessao.addEventListener("end", this.aoEncerrar, { once: true });
      sessao.addEventListener("visibilitychange", this.aoVisibilidade);
      this.renderer.xr.setReferenceSpaceType("local");
      this.renderer.xr.setFoveation(1);
      await this.renderer.xr.setSession(sessao);
      if (this.sessao !== sessao || geracao !== this.geracao || this.encerrado) return;
      this.referencia = this.renderer.xr.getReferenceSpace();
      if (!this.referencia) throw new Error("sem-referencia");
      this.referencia.addEventListener("reset", this.reposicionar);
      this.reposicionar();
      // Mesmo fluxo do cachorrinho: a pose XR libera a posição manual antes
      // de qualquer superfície. Hit-test é uma ajuda opcional, não uma barreira.
      try {
        const viewer = await sessao.requestReferenceSpace("viewer");
        const hit = await sessao.requestHitTestSource?.({ space: viewer });
        if (this.sessao !== sessao || geracao !== this.geracao || this.encerrado) { hit?.cancel(); return; }
        this.hit = hit ?? null;
      } catch {
        if (this.sessao === sessao && !this.colocado && geracao === this.geracao)
          this.emitir("buscando", "Posicione manualmente para começar. Você pode ajustar a altura depois.");
      }
    } catch (erro) {
      if (sessao && this.sessao === sessao) await sessao.end().catch(() => {});
      if (geracao !== this.geracao) return;
      this.rastreando = true;
      this.origem.visible = true;
      this.emitir("3d", erro instanceof DOMException && erro.name === "NotAllowedError"
        ? "A câmera não foi autorizada. Tente novamente quando quiser; o 3D continua disponível."
        : "Não foi possível abrir a AR. Você pode continuar em 3D ou tentar novamente.");
    } finally { this.iniciando = false; }
  }

  atualizar(frame?: XRFrame) {
    if (!this.sessao || !this.referencia || !frame) return;
    const viewer = frame.getViewerPose(this.referencia);
    this.temPose = !!viewer?.transform?.matrix && viewer.transform.matrix.length === 16 && viewer.transform.matrix.every(Number.isFinite);
    this.rastreando = this.sessao.visibilityState === "visible" && this.temPose;
    this.origem.visible = this.colocado && this.rastreando;
    this.reticulo.visible = false;
    this.superficie = false;
    if (!this.rastreando) {
      this.ultimoHit = -Infinity;
      this.emitir(this.colocado ? this.ajustando ? "ajustando" : "colocado" : "buscando", "Rastreamento pausado. Mova o celular devagar para reencontrar o lugar.");
      return;
    }
    this.matrizViewer.fromArray(viewer!.transform.matrix);
    this.camera.setFromMatrixPosition(this.matrizViewer);
    if (this.colocado) {
      this.emitir(this.ajustando ? "ajustando" : "colocado", this.ajustando
        ? "Ajuste a altura para encostar a tábua na mesa e toque em Pronto."
        : "Pronto na sua mesa. Experimente as opções no canto.");
      return;
    }
    this.direcao.set(0, 0, -1).transformDirection(this.matrizViewer);
    // O resultado mais próximo pode ser uma parede, uma borda ou não ter pose.
    // Continua a busca até a primeira superfície adequada na mesma direção.
    const resultados = this.hit ? frame.getHitTestResults(this.hit) : [];
    for (const resultado of resultados) {
      const pose = resultado.getPose(this.referencia);
      if (!pose) continue;
      this.matriz.fromArray(pose.transform.matrix);
      if (!this.matriz.elements.every(Number.isFinite)) continue;
      this.normal.set(0, 1, 0).transformDirection(this.matriz);
      // Tolera inclinação/ruído de até ~25°, mantendo paredes e tetos fora.
      if (this.normal.y >= 0.9) {
        this.reticulo.matrix.copy(this.matriz);
        this.reticulo.matrixWorldNeedsUpdate = true;
        this.superficie = true;
        this.ultimoHit = this.agora();
        this.cameraHit.copy(this.camera); this.direcaoHit.copy(this.direcao);
        break;
      }
    }
    // Pequenas falhas entre quadros não devem fazer o botão piscar. O último
    // ponto só vale por 350 ms e enquanto o celular praticamente não se moveu.
    if (!this.superficie && this.agora() - this.ultimoHit <= 350
      && this.camera.distanceToSquared(this.cameraHit) <= 0.0064
      && this.direcao.dot(this.direcaoHit) >= 0.98) this.superficie = true;
    this.reticulo.visible = this.superficie;
    this.emitir(this.superficie ? "superficie" : "buscando", this.superficie
      ? "Você pode posicionar manualmente ou usar o ponto detectado."
      : "Toque em Posicionar manualmente para começar. Não precisa procurar uma superfície.");
  }

  colocarManualmente() {
    if (!this.sessao || !this.rastreando || !this.temPose || this.colocado) return false;
    this.baseManual.setFromMatrixPosition(this.matrizViewer);
    this.frenteManual.set(0, 0, -1).transformDirection(this.matrizViewer);
    this.frenteManual.y = 0;
    if (this.frenteManual.lengthSq() < 0.01) {
      this.frenteManual.set(0, 1, 0).transformDirection(this.matrizViewer); this.frenteManual.y = 0;
    }
    if (this.frenteManual.lengthSq() < 0.01) this.frenteManual.set(0, 0, -1);
    this.frenteManual.normalize();
    // O cachorro começa perto do chão; o lanche começa perto da altura da mesa.
    this.alturaInicial = this.baseManual.y - 0.35;
    this.ajusteAltura = 0; this.ajusteDistancia = 0.65;
    this.manual = true; this.ajustando = true; this.colocado = true;
    this.superficie = false; this.reticulo.visible = false;
    this.aplicarAjuste();
    this.origem.rotation.set(0, Math.atan2(this.baseManual.x - this.origem.position.x, this.baseManual.z - this.origem.position.z), 0);
    return true;
  }

  private aplicarAjuste() {
    this.origem.position.copy(this.baseManual).addScaledVector(this.frenteManual, this.ajusteDistancia);
    this.origem.position.y = this.alturaInicial + this.ajusteAltura;
    this.origem.visible = this.rastreando;
    this.emitir("ajustando", "Ajuste a altura para encostar a tábua na mesa e toque em Pronto.");
  }
  ajustarAltura(delta: number) {
    if (!this.ajustando || !this.rastreando || !Number.isFinite(delta)) return;
    this.ajusteAltura = Math.max(-0.6, Math.min(0.6, delta)); this.aplicarAjuste();
  }
  ajustarDistancia(distancia: number) {
    if (!this.ajustando || !this.rastreando || !Number.isFinite(distancia)) return;
    this.ajusteDistancia = Math.max(0.35, Math.min(1.5, distancia)); this.aplicarAjuste();
  }
  confirmarManual() {
    if (!this.ajustando || !this.colocado || !this.rastreando) return false;
    this.ajustando = false;
    this.emitir("colocado", "Pronto na sua mesa. Experimente as opções no canto.");
    return true;
  }
  editarPosicao() {
    if (!this.colocado || !this.rastreando || !this.temPose) return false;
    this.baseManual.setFromMatrixPosition(this.matrizViewer);
    this.frenteManual.copy(this.origem.position).sub(this.baseManual); this.frenteManual.y = 0;
    this.ajusteDistancia = this.frenteManual.length();
    if (this.ajusteDistancia < 0.01) this.frenteManual.set(0, 0, -1); else this.frenteManual.normalize();
    this.alturaInicial = this.origem.position.y; this.ajusteAltura = 0;
    this.manual = true; this.ajustando = true;
    this.emitir("ajustando", "Ajuste a altura para encostar a tábua na mesa e toque em Pronto.");
    return true;
  }

  colocar() {
    if (!this.sessao || !this.superficie || !this.rastreando || this.colocado || this.agora() - this.ultimoHit > 350) return false;
    this.origem.position.setFromMatrixPosition(this.reticulo.matrix);
    this.camera.setFromMatrixPosition(this.renderer.xr.getCamera().matrixWorld);
    this.origem.rotation.set(0, Math.atan2(this.camera.x - this.origem.position.x, this.camera.z - this.origem.position.z), 0);
    this.colocado = true;
    this.manual = false; this.ajustando = false;
    this.origem.visible = true;
    this.reticulo.visible = false;
    this.emitir("colocado", "Pronto na sua mesa. Experimente as opções no canto.");
    return true;
  }

  reposicionar = () => {
    this.ultimoHit = -Infinity;
    this.temPose = false; this.rastreando = false;
    this.manual = false; this.ajustando = false; this.ajusteAltura = 0; this.ajusteDistancia = 0.65;
    this.colocado = false; this.superficie = false; this.reticulo.visible = false;
    this.origem.visible = false;
    this.emitir("buscando", "Preparando a câmera para você posicionar o lanche.");
  };

  private aoVisibilidade = () => {
    this.ultimoHit = -Infinity;
    this.rastreando = false; this.superficie = false;
    this.temPose = false;
    this.reticulo.visible = false; this.origem.visible = false;
    this.emitir(this.colocado ? this.ajustando ? "ajustando" : "colocado" : "buscando", "AR pausada. Volte para a câmera para continuar.");
  };
  private aoEncerrar = () => {
    this.ultimoHit = -Infinity;
    this.hit?.cancel(); this.hit = null;
    this.referencia?.removeEventListener("reset", this.reposicionar); this.referencia = null;
    this.sessao?.removeEventListener("visibilitychange", this.aoVisibilidade); this.sessao = null;
    this.colocado = false; this.superficie = false; this.rastreando = true;
    this.temPose = false; this.manual = false; this.ajustando = false; this.ajusteAltura = 0; this.ajusteDistancia = 0.65;
    this.reticulo.visible = false;
    this.origem.position.set(0, 0, 0); this.origem.rotation.set(0, 0, 0); this.origem.visible = true;
    this.emitir("3d", ESTADO_3D.mensagem);
  };
  async sair() {
    this.geracao++;
    await this.sessao?.end().catch(() => {});
  }
  destruir() {
    this.encerrado = true;
    this.hit?.cancel(); this.hit = null;
    this.referencia?.removeEventListener("reset", this.reposicionar);
    void this.sair();
  }
}
