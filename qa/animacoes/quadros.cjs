// Tira quadros de um vídeo gravado (video.cjs) e monta uma tira: node qa/animacoes/quadros.cjs <video.webm> <início s>
//   <duração s> <a cada N quadros> <saída.png> [recorte x,y,l,a]. Precisa de FFMPEG=<binário do ffmpeg>.
const { execFileSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path"), sharp = require("sharp");
(async () => {
  const [video, ini, dur, cada, saida, recorte] = process.argv.slice(2);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quadros-"));
  execFileSync(process.env.FFMPEG || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", ini, "-i", video, "-t", dur, "-y", path.join(tmp, "q%03d.png")]);
  const todos = fs.readdirSync(tmp).sort().filter((_, i) => i % Number(cada) === 0).slice(0, 12);
  const [x, y, l, a] = (recorte || "0,0,390,844").split(",").map(Number);
  const partes = await Promise.all(todos.map((f) => sharp(path.join(tmp, f)).extract({ left: x, top: y, width: l, height: a }).toBuffer()));
  const col = Math.min(4, partes.length), lin = Math.ceil(partes.length / col);
  await sharp({ create: { width: l * col, height: a * lin, channels: 3, background: "#000" } })
    .composite(partes.map((b, i) => ({ input: b, left: (i % col) * l, top: Math.floor(i / col) * a }))).png().toFile(saida);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(saida, partes.length);
})();
