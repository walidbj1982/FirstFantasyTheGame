#!/usr/bin/env bash
# Grab a still every N seconds from a movie file and build a numbered contact sheet,
# so you can pick frames for portraits (tools/make_portrait.sh) and scene backdrops.
#   usage: tools/extract_frames.sh movie.mp4 out_dir [every_seconds=5]
set -euo pipefail
movie=${1:?movie file}; out=${2:?output dir}; every=${3:-5}
mkdir -p "$out"
ffmpeg -hide_banner -loglevel error -i "$movie" -vf "fps=1/$every,scale=640:-2" -q:v 3 "$out/frame_%04d.jpg"
# contact sheet: 6 frames per row, each labelled with its timestamp
ffmpeg -hide_banner -loglevel error -i "$movie" \
  -vf "fps=1/$every,scale=240:-2,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=6x8" \
  -q:v 3 "$out/contact_%03d.jpg"
echo "Frames in $out (frame_NNNN.jpg is at $every*(NNNN-1) seconds). Contact sheets: $out/contact_*.jpg"
