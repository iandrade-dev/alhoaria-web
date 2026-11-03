#!/bin/bash
# Gera a mídia do hero: hero-desktop.mp4, hero-mobile.mp4, poster.webp, poster-final.webp.
#
# uso: scripts/hero-media.sh [ENTRADA_1.mp4] [ENTRADA_2.mp4] [PASTA_DESTINO]
#   (sem argumentos usa os vídeos de alhoaria props e public/assets/hero deste worktree)
#
# variáveis opcionais:
#   CRF_DESKTOP (24), CRF_MOBILE (27)  qualidade do x264
#   XFADE_DUR (0.5)                     duração do fade entre os clipes
#   CURVE_1, CURVE_2                    curvas (0-1) aplicadas em RGB para cada clipe
#
# Requer ffmpeg/ffprobe com libx264 e libwebp.
set -euo pipefail

SRC_DIR="/mnt/c/Users/igors/OneDrive/Documentos/alhoaria props"
IN1="${1:-$SRC_DIR/fenaky (1).mp4}"
IN2="${2:-$SRC_DIR/fenaky (2).mp4}"
OUT="${3:-/home/igor/wt/alhoaria-web-hero-media/public/assets/hero}"

CRF_DESKTOP="${CRF_DESKTOP:-24}"
CRF_MOBILE="${CRF_MOBILE:-27}"
XFADE_DUR="${XFADE_DUR:-0.5}"
# Clipe 1 (fundo #0F-#16 com cantos ~#03): pretos e cinzas do fundo caem para ~#0A.
CURVE_1="${CURVE_1:-0/0.047 0.086/0.047 0.25/0.25 1/1}"
# Clipe 2 (fundo #000): sobe o preto para ~#0A; tons médios não mudam.
CURVE_2="${CURVE_2:-0/0.047 0.19/0.19 1/1}"

MAX_DESKTOP=10000000   # 10 MB
MAX_MOBILE=5000000     # 5 MB
MAX_POSTER=150000      # 150 KB

mkdir -p "$OUT"

# Normalização de cada entrada: fps, timebase, timestamps zerados, curva de fundo, yuv420p.
norm() { # $1 índice da entrada, $2 curva, $3 filtro extra de tamanho (opcional)
  local extra="${3:+,$3}"
  echo "[$1:v]fps=24,settb=AVTB,setpts=PTS-STARTPTS,format=rgb24,curves=all='$2',format=yuv420p${extra}"
}

D1=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN1")
OFF=$(awk -v d="$D1" -v x="$XFADE_DUR" 'BEGIN { printf "%.3f", d - x }')
echo "duracao1=${D1}s offset=${OFF}s xfade=${XFADE_DUR}s"

encode() { # $1 saída, $2 filtro complexo, $3 crf
  ffmpeg -v error -y -i "$IN1" -i "$IN2" -filter_complex "$2" -map "[v]" -an \
    -c:v libx264 -preset medium -crf "$3" -profile:v high -pix_fmt yuv420p \
    -g 1 -keyint_min 1 -sc_threshold 0 -movflags +faststart "$1"
}

FC_DESKTOP="$(norm 0 "$CURVE_1")[a];$(norm 1 "$CURVE_2")[b];[a][b]xfade=transition=fade:duration=${XFADE_DUR}:offset=${OFF}[v]"
# Mobile: 854x486 e corte de 6 px no topo/base -> 854x480 sem distorcer a proporção.
FC_MOBILE="$(norm 0 "$CURVE_1" "scale=854:486:flags=lanczos,crop=854:480")[a];$(norm 1 "$CURVE_2" "scale=854:486:flags=lanczos,crop=854:480")[b];[a][b]xfade=transition=fade:duration=${XFADE_DUR}:offset=${OFF}[v]"

echo "== desktop crf=${CRF_DESKTOP}"
encode "$OUT/hero-desktop.mp4" "$FC_DESKTOP" "$CRF_DESKTOP"
echo "== mobile crf=${CRF_MOBILE}"
encode "$OUT/hero-mobile.mp4" "$FC_MOBILE" "$CRF_MOBILE"

check_size() { # $1 arquivo, $2 limite
  local s; s=$(stat -c %s "$1")
  echo "$(basename "$1") $s bytes (limite $2)"
  [ "$s" -le "$2" ] || echo "AVISO: acima do limite"
}
check_size "$OUT/hero-desktop.mp4" "$MAX_DESKTOP"
check_size "$OUT/hero-mobile.mp4" "$MAX_MOBILE"

# Posters: primeiro e último quadro do hero-desktop.mp4, WebP com qualidade reduzida até caber em 150 KB.
webp() { # $1 saída, $2 filtro de seleção
  local q
  for q in 80 70 60 50; do
    ffmpeg -v error -y -i "$OUT/hero-desktop.mp4" -vf "$2" -frames:v 1 \
      -c:v libwebp -quality "$q" "$1"
    [ "$(stat -c %s "$1")" -le "$MAX_POSTER" ] && break
  done
  echo "$(basename "$1") q=${q} $(stat -c %s "$1") bytes (limite ${MAX_POSTER})"
}
NFRAMES=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/hero-desktop.mp4")
webp "$OUT/poster.webp" "select=eq(n\,0)"
webp "$OUT/poster-final.webp" "select=eq(n\,$((NFRAMES - 1)))"
