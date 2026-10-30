#!/usr/bin/env bash
# Save one full frame at a timestamp as a cutscene / boss backdrop.
#   usage: tools/save_still.sh movie.mp4 00:12:34 assets/scenes/boss1.jpg
set -euo pipefail
movie=${1:?movie}; at=${2:?timestamp}; out=${3:?output jpg}
mkdir -p "$(dirname "$out")"
ffmpeg -hide_banner -loglevel error -y -ss "$at" -i "$movie" -frames:v 1 -vf "scale=640:-2" -q:v 3 "$out"
echo "Saved $out  ->  set it in CONFIG.scenes in js/data/config.js"
