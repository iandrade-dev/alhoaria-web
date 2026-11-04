import { motion } from "framer-motion";
import { useId } from "react";
import type { LayoutBancada } from "./layout";
import { PASSOS, type EstadoBancada, type PassoId } from "./passos";

type Props = {
  estado: EstadoBancada;
  reduzido: boolean;
  aoTerminar: () => void;
  layout: LayoutBancada;
  destacado: boolean;
  manchas: { x: number; y: number }[];
};

const origem = { transformBox: "fill-box", transformOrigin: "center center" } as const;
const tem = (estado: EstadoBancada, id: PassoId) => estado.colocados.has(id);
const pedacos = [
  { x: 104, y: 326, r: -18 }, { x: 132, y: 311, r: 12 },
  { x: 162, y: 328, r: -7 }, { x: 189, y: 312, r: 24 },
  { x: 221, y: 325, r: -16 }, { x: 248, y: 308, r: 6 },
  { x: 278, y: 329, r: 22 }, { x: 309, y: 314, r: -11 },
  { x: 117, y: 341, r: 13 }, { x: 176, y: 339, r: -23 },
  { x: 235, y: 341, r: 16 }, { x: 293, y: 337, r: -17 },
];

export default function CenaBancada({ estado, reduzido, aoTerminar, layout, destacado, manchas }: Props) {
  const uid = useId().replace(/:/g, "");
  const luz = `${uid}-luz`;
  const madeira = `${uid}-madeira`;
  const ativo = (id: PassoId) => estado.animando && PASSOS[estado.passoAtual]?.id === id;
  const duracao = reduzido ? 0.12 : 1.2;
  const queijo = tem(estado, "creme") || tem(estado, "mussarela");
  const descricao = estado.colocados.size
    ? `Bancada com ${PASSOS.filter((passo) => tem(estado, passo.id)).map((passo) => passo.nome.toLowerCase()).join(", ")}.`
    : "Tábua vazia na bancada, pronta para montar A Costela!";

  return (
    <svg x={layout.cena.x} y={layout.cena.y} width={layout.cena.largura} height={layout.cena.altura} viewBox="0 0 400 440" role="img" aria-label={descricao} className="overflow-visible" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={luz} cx="50%" cy="15%" r="75%"><stop stopColor="#745037" /><stop offset="1" stopColor="#271d1d" /></radialGradient>
        <linearGradient id={madeira} x2="0" y2="1"><stop stopColor="#a36c40" /><stop offset="1" stopColor="#70432e" /></linearGradient>
      </defs>
      {/* Cozinha à noite, prateleira e quadrinhos. */}
      <path fill={`url(#${luz})`} d="M0 0h400v260H0z" />
      <path d="M0 196h400v14H0z" fill="#201716" opacity=".5" />
      <path d="M24 61h68v82H24z M296 52h72v91h-72z" fill="#171516" stroke="#b98755" strokeWidth="5" />
      <path d="M34 73h48v58H34z" fill="#58634c" /><circle cx="60" cy="99" r="16" fill="#deac65" /><path d="M40 121q20-25 42 0" fill="#293e37" />
      <path d="M306 64h52v66h-52z" fill="#65514b" /><path d="M312 107q15-31 39-27v44h-39z" fill="#d2ae7b" /><circle cx="331" cy="88" r="8" fill="#e5c68b" />
      <path d="M118 145h164v9H118z" fill="#b58958" /><path d="M128 154h10v7h-10z M262 154h10v7h-10z" fill="#493023" />
      <path d="M145 107h31l-3 36h-25z" fill="#d5ae80" /><path d="M150 117h21 M152 124h17" stroke="#9b724c" strokeWidth="2" />
      <path d="M212 127q-18-14-10-27 13 1 13 22 0-25 18-27 5 20-13 34 20-19 30-9-3 17-28 15" fill="#64835d" />
      <path d="M199 129h38l-5 16h-28z" fill="#c68158" />
      <path d="M172 0h56l-18 62h-20z" fill="#a9794b" opacity=".25" /><ellipse cx="200" cy="229" rx="160" ry="64" fill="#e9b776" opacity=".11" />
      {/* A bancada e a tábua são fixas, mesmo se todos os passos forem pulados. */}
      <path d="M0 218h400v222H0z" fill={`url(#${madeira})`} />
      <path d="M0 220h400M0 414h400M15 232q80 8 161 1M248 231q78-8 142 2" stroke="#c38d59" strokeWidth="3" opacity=".55" fill="none" />
      <rect x="21" y="269" width="358" height="143" rx="32" fill="#523121" opacity=".5" />
      <rect x="18" y="259" width="364" height="141" rx="29" fill="#d5a36b" stroke="#f3c58d" strokeWidth="3" />
      <path d="M37 286q76-9 149 0M225 278q91 8 130 0M41 379q101 12 183 0M258 383q71-8 99-2" fill="none" stroke="#aa764a" strokeWidth="3" opacity=".45" />
      <ellipse cx="201" cy="365" rx="149" ry="25" fill="#62412d" opacity=".28" />
      {destacado && <ellipse cx="200" cy="325" rx="173" ry="66" fill="#f6dc88" opacity=".24" stroke="#ffe37e" strokeWidth="8" />}
      {destacado && <ellipse cx="200" cy="326" rx="125" ry="19" fill="#fff1b4" opacity=".38" />}
      {tem(estado, "pao") && (
        <motion.ellipse cx="200" cy="356" rx="145" ry="21" fill="#6a3925" style={origem}
          initial={!ativo("pao") ? false : reduzido ? { opacity: 0 } : { scale: .55, opacity: 0 }} animate={{ scale: 1, opacity: .3 }} transition={{ duration: duracao }} />
      )}
      {tem(estado, "pao") && (
        <motion.g style={origem} initial={!ativo("pao") ? false : reduzido ? { opacity: 0 } : { y: -270, opacity: 0, scale: 0.85 }}
          animate={reduzido ? { opacity: 1 } : { y: [-270, 0, -15, 0], opacity: [0, 1, 1, 1], scaleY: [1, .85, 1.05, 1], scaleX: [1, 1.06, .98, 1] }} transition={reduzido ? { duration: duracao } : { duration: 1.1, times: [0, 0.68, 0.84, 1], ease: "easeOut" }}
          onAnimationComplete={ativo("pao") && !reduzido ? aoTerminar : undefined}>
          <path d="M58 331q-4-27 28-35 36-15 109-14 82-2 119 12 31 9 28 37-3 21-45 27-92 15-195 0-39-7-44-27z" fill="#a9582d" stroke="#794124" strokeWidth="3" />
          <path d="M59 321q0-34 42-40 94-19 194 0 43 6 46 39-3 26-46 30-94 10-192-1-39-4-44-28z" fill="#eeb867" stroke="#a86738" strokeWidth="3" />
          <path d="M86 304q40-26 104-17M262 291q34 0 51 14" fill="none" stroke="#fff0b4" strokeWidth="6" opacity=".7" strokeLinecap="round" />
          <path d="M102 298l-16 25M150 291l-17 38M197 289l-12 42M247 292l-12 39M297 300l-11 30" stroke="#a76135" strokeWidth="6" strokeLinecap="round" opacity=".65" />
        </motion.g>
      )}
      {tem(estado, "pasta") && (
        <>
          <motion.path d="M77 320q24-23 46 1t45-1 44 1 45-1 44 0" fill="none" stroke="#f9edd0" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" style={origem}
            initial={!ativo("pasta") ? false : reduzido ? { opacity: 0 } : { pathLength: 0, opacity: 0 }} animate={reduzido ? { opacity: 1 } : { pathLength: 1, opacity: 1 }} transition={{ duration: reduzido ? duracao : duracao * 0.84, delay: reduzido ? 0 : 0.19 }}
            onAnimationComplete={ativo("pasta") && !reduzido ? aoTerminar : undefined} />
          <motion.path d="M83 317q24-16 39 3t48-2 44 3 45-2 39 0" fill="none" stroke="#fff9e9" strokeWidth="3" style={origem}
            initial={ativo("pasta") ? { opacity: 0 } : false} animate={{ opacity: .8 }} transition={{ duration: reduzido ? duracao : .15, delay: reduzido ? 0 : .98 }} />
          {ativo("pasta") && !reduzido && (
            <motion.g style={origem} initial={{ x: -160 }} animate={{ x: [-160, 0, 0, -160], scaleX: [1, 1, 0.85, 1] }} transition={{ duration: 1.2, times: [0, .25, .67, 1] }}>
              <path d="M40 224l18 15 23-2-14-22z" fill="#ee6b27" stroke="#432a25" strokeWidth="3" />
              <path d="M71 232l35 39-14 15-39-32z" fill="#eadcc2" stroke="#66574a" strokeWidth="3" />
              <path d="M104 270l8 11-15 8-8-8z" fill="#d8c3a3" />
              <path d="M28 204q23-13 43 5l-3 20-32 2-17-11z" fill="#f9efd9" stroke="#564940" strokeWidth="3" />
            </motion.g>
          )}
        </>
      )}
      {tem(estado, "costela") && (
        <>
          {ativo("costela") && !reduzido && (
            <motion.g style={origem} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.15, times: [0, .1, .7, 1] }}>
              <path d="M31 372q1-19 23-21l30 3q21 20-2 30l-34 5z" fill="#924932" stroke="#633227" strokeWidth="3" />
              <path d="M48 363l7 15m11-16 7 14m12-16 6 12" stroke="#d99360" strokeWidth="3" strokeLinecap="round" />
            </motion.g>
          )}
          {pedacos.map((p, i) => (
            <motion.g key={i} style={origem} initial={!ativo("costela") ? false : reduzido ? { opacity: 0 } : { y: -95 - i * 5, x: i % 2 ? 50 : -40, opacity: 0, rotate: -30 }}
              animate={reduzido ? { opacity: 1 } : { x: 0, y: 0, opacity: 1, rotate: p.r }} transition={{ duration: reduzido ? duracao : 0.75, delay: reduzido ? 0 : 0.37 + i * 0.055, type: "tween", ease: [0.2, 0.65, 0.3, 1] }}
              onAnimationComplete={i === pedacos.length - 1 && ativo("costela") && !reduzido ? aoTerminar : undefined}>
              <path d={`M${p.x-17} ${p.y+3}q9-14 19-10t17-3q-9 2-14 9t-22 4z`} fill={i % 3 === 0 ? "#9e4730" : "#82402e"} stroke="#622f27" strokeWidth="1.5" />
              <path d={`M${p.x-7} ${p.y-5}q7-5 13 0`} stroke="#e2a070" strokeWidth="3" strokeLinecap="round" fill="none" />
            </motion.g>
          ))}
          {ativo("costela") && !reduzido && (
            <motion.g style={origem} initial={{ x: -165, opacity: 0 }} animate={{ x: [-165, 0, 0, -165], opacity: [0, 1, 1, 0], rotate: [0, -16, 9, 0, -15, 7, 0] }} transition={{ duration: 1.3, times: [0, .24, .4, .51, .6, .72, 1] }}>
              <path d="M38 238l36 30-12 17-35-23z" fill="#f9eedb" stroke="#58453d" strokeWidth="3" />
              <path d="M66 277l28-8 20 12-39 18z" fill="#b8c1bc" stroke="#52605d" strokeWidth="3" />
              <path d="M88 277l53-14-27 31-36 1z" fill="#e8e1d3" stroke="#65716b" strokeWidth="2" />
              <path d="M45 244l-35-29" stroke="#f8eedc" strokeWidth="19" strokeLinecap="round" />
            </motion.g>
          )}
        </>
      )}
      {tem(estado, "creme") && (
        <motion.g style={origem} initial={!ativo("creme") ? false : reduzido ? { opacity: 0 } : { scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: duracao, ease: "easeOut" }}
          onAnimationComplete={ativo("creme") && !reduzido ? aoTerminar : undefined}>
          <path d="M74 317q19-15 35-4t38 0 42 2 42-3 39 1 44 1q10 3 2 13-6 5-12 0-10 10-27 2-8 19-15 17-7 0-7-17-20 11-42 1-12 15-19 10-4-4-3-11-26 7-45-2-7 14-14 11-5-3-2-15-13 9-34 4-17-3-22-10z" fill="#f7e3ae" stroke="#d8b578" strokeWidth="2" />
          <path d="M112 318q53-12 86 0t90-3" fill="none" stroke="#fff4d5" strokeWidth="5" opacity=".8" />
        </motion.g>
      )}
      {tem(estado, "mussarela") && (
        <motion.g style={origem} initial={!ativo("mussarela") ? false : reduzido ? { opacity: 0 } : { y: -190, scaleY: 0.5, opacity: 0 }} animate={{ y: 0, scaleY: 1, opacity: 1 }} transition={{ duration: duracao, ease: [0.2, 0.75, 0.3, 1] }}
          onAnimationComplete={ativo("mussarela") && !reduzido ? aoTerminar : undefined}>
          <path d="M78 314q23-18 44-10 24-13 46-1 29-13 48 1 32-12 51 1 28-8 49 12l-8 17q-15 11-26 0-14 14-35 5-13 17-26 6-17 9-34-2-22 11-37-2-20 11-31-4-21 11-37-2z" fill="#f6dc88" stroke="#dfb75c" strokeWidth="3" />
          <path d="M93 311q17-11 36-4m38 0q25-9 41 0m45 0q20-7 42 5" stroke="#fff1b4" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M122 338q0 15 7 15t7-12m120-2q0 18 8 17t7-20" fill="#f6dc88" stroke="#dfb75c" strokeWidth="2" />
        </motion.g>
      )}
      {manchas.length > 0 && queijo && manchas.map((p, i) => (
        <g key={i} opacity=".8"><ellipse cx={p.x} cy={p.y} rx="13" ry="5" fill="#b56d31" transform={`rotate(${(i % 3 - 1) * 13} ${p.x} ${p.y})`} />
          {!reduzido && <path d={`M${p.x + 8} ${p.y - 6}l3-5 2 4`} stroke="#ffd67d" strokeWidth="2" fill="none" />}</g>
      ))}
      {tem(estado, "macarico") && queijo && manchas.length === 0 && (
        <motion.g style={origem} initial={ativo("macarico") ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: reduzido ? duracao : 0.45, delay: reduzido ? 0 : 0.76 }}>
          {tem(estado, "creme") && <path d="M101 326q12-9 24-2m80 6q13-9 26-2m44-1q9-6 18-1" fill="none" stroke="#c77c39" strokeWidth="6" strokeLinecap="round" opacity=".8" />}
          {tem(estado, "mussarela") && <path d="M88 318q18-12 30-3m43-4q18-12 34-3m42 3q16-11 33 1m21 8 11-3" fill="none" stroke="#b56d31" strokeWidth="8" strokeLinecap="round" opacity=".8" />}
        </motion.g>
      )}
      {ativo("macarico") && !reduzido && (
        <motion.g style={origem} initial={{ x: -180, opacity: 0 }} animate={{ x: [-180, -5, 115, 245], opacity: [0, 1, 1, 0] }} transition={{ duration: 1.45, times: [0, .22, .76, 1] }} onAnimationComplete={aoTerminar}>
          <path d="M35 236l-33-14" stroke="#f9eed9" strokeWidth="21" strokeLinecap="round" />
          <path d="M29 210q18-8 33 4l-5 28-25 2-13-13z" fill="#f9eed9" stroke="#544036" strokeWidth="3" />
          <path d="M54 216l40-11 12 36-40 11z" fill="#f36b26" stroke="#372b28" strokeWidth="4" />
          <path d="M67 221l16-4 7 22-16 4z" fill="#2a3030" /><circle cx="84" cy="216" r="5" fill="#d8aa6c" />
          <path d="M99 220l16-5 10 10-17 9z" fill="#aeb6af" stroke="#445453" strokeWidth="3" />
          <path d="M119 226q10 6 15 19-13-5-19-2l-3-12z" fill="#65c7ee" />
          <motion.path d="M128 236q26 13 21 52-21-17-35-37z" fill="#ff9b38" style={origem} animate={{ scaleY: [1, .85, 1] }} transition={{ duration: .22, repeat: 5 }} />
          <path d="M126 240q12 10 11 32-14-12-18-26z" fill="#70d8ef" />
        </motion.g>
      )}
      {estado.passoAtual === 6 && estado.colocados.size > 0 && <path d="M29 272l5-8 5 8-5 8zM364 280l4-7 4 7-4 7zM340 374l4-7 4 7-4 7z" fill="#ffe1a0" opacity=".8" />}
    </svg>
  );
}
