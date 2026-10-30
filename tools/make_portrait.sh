#!/usr/bin/env bash
# Crop a square face out of a still and save it as a 128x128 portrait.
#   usage: tools/make_portrait.sh frame.jpg x y size assets/portraits/hero1.png
#   (x, y = top-left corner of the square in the source image, size = its width in pixels)
set -euo pipefail
src=${1:?image}; x=${2:?x}; y=${3:?y}; size=${4:?size}; out=${5:?output png}
mkdir -p "$(dirname "$out")"
ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "crop=$size:$size:$x:$y,scale=128:128:flags=lanczos" "$out"
echo "Saved $out  ->  set  portrait: '$out'  in js/data/cast.js"
