import { Matrix4, Vector3, type Group, type Mesh, type WebGLRenderer } from "three";

export type EstadoAR = {
  fase: "3d" | "iniciando" | "buscando" | "superficie" | "colocado";
  rastreando: boolean;
  mensagem: string;
};
export const ESTADO_3D: EstadoAR = { fase: "3d", rastreando: true, mensagem: "Arraste para girar e conhecer o lanche." };

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

  constructor(
    private renderer: WebGLRenderer,
    private overlay: HTMLElement,
    private origem: Group,
    private reticulo: Mesh,
    private mudar: (estado: EstadoAR) => void,
    private agora: () => number = () => performance.now(),
  ) {}

  private emitir(fase: EstadoAR["fase"], mensagem: string) {
    const chave = `${fase}/${this.rastreando}/${mensagem}`;
    if (this.encerrado || chave === this.ultimo) return;
    this.ultimo = chave;
    this.mudar({ fase, rastreando: this.rastreando, mensagem });
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
        requiredFeatures: ["hit-test", "dom-overlay"],
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
      const viewer = await sessao.requestReferenceSpace("viewer");
      const hit = await sessao.requestHitTestSource?.({ space: viewer });
      if (!hit) throw new Error("sem-superficie");
      if (this.sessao !== sessao || geracao !== this.geracao || this.encerrado) { hit.cancel(); return; }
      this.hit = hit;
      this.referencia = this.renderer.xr.getReferenceSpace();
      if (!this.referencia) throw new Error("sem-referencia");
      this.referencia.addEventListener("reset", this.reposicionar);
      this.reposicionar();
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
    this.rastreando = this.sessao.visibilityState === "visible" && !!viewer;
    this.origem.visible = this.colocado && this.rastreando;
    this.reticulo.visible = false;
    this.superficie = false;
    if (!this.rastreando) {
      this.ultimoHit = -Infinity;
      this.emitir(this.colocado ? "colocado" : "buscando", "Rastreamento pausado. Mova o celular devagar para reencontrar o lugar.");
      return;
    }
    if (this.colocado) { this.emitir("colocado", "Pronto na sua mesa. Experimente as opções no canto."); return; }
    this.matrizViewer.fromArray(viewer!.transform.matrix);
    this.camera.setFromMatrixPosition(this.matrizViewer);
    this.direcao.set(0, 0, -1).transformDirection(this.matrizViewer);
    // O resultado mais próximo pode ser uma parede, uma borda ou não ter pose.
    // Continua a busca até a primeira superfície adequada na mesma direção.
    const resultados = this.hit ? frame.getHitTestResults(this.hit) : [];
    for (const resultado of resultados) {
      const pose = resultado.getPose(this.referencia);
      if (!pose) continue;
      this.matriz.fromArray(pose.transform.matrix);
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
      ? "Lugar encontrado. Toque em Colocar aqui."
      : "Mire o centro da tela na mesa e mova o celular devagar para os lados.");
  }

  colocar() {
    if (!this.sessao || !this.superficie || !this.rastreando || this.colocado || this.agora() - this.ultimoHit > 350) return false;
    this.origem.position.setFromMatrixPosition(this.reticulo.matrix);
    this.camera.setFromMatrixPosition(this.renderer.xr.getCamera().matrixWorld);
    this.origem.rotation.set(0, Math.atan2(this.camera.x - this.origem.position.x, this.camera.z - this.origem.position.z), 0);
    this.colocado = true;
    this.origem.visible = true;
    this.reticulo.visible = false;
    this.emitir("colocado", "Pronto na sua mesa. Experimente as opções no canto.");
    return true;
  }

  reposicionar = () => {
    this.ultimoHit = -Infinity;
    this.colocado = false; this.superficie = false; this.reticulo.visible = false;
    this.origem.visible = false;
    this.emitir("buscando", "Mire o centro da tela na mesa e mova o celular devagar para os lados.");
  };

  private aoVisibilidade = () => {
    this.ultimoHit = -Infinity;
    this.rastreando = false; this.superficie = false;
    this.reticulo.visible = false; this.origem.visible = false;
    this.emitir(this.colocado ? "colocado" : "buscando", "AR pausada. Volte para a câmera para continuar.");
  };
  private aoEncerrar = () => {
    this.ultimoHit = -Infinity;
    this.hit?.cancel(); this.hit = null;
    this.referencia?.removeEventListener("reset", this.reposicionar); this.referencia = null;
    this.sessao?.removeEventListener("visibilitychange", this.aoVisibilidade); this.sessao = null;
    this.colocado = false; this.superficie = false; this.rastreando = true;
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
