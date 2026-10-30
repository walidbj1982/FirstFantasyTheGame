#!/usr/bin/env bash
# Cut a voice line or a piece of soundtrack out of the movie (with short fades).
#   usage: tools/cut_audio.sh movie.mp4 start duration output.mp3
#   e.g.   tools/cut_audio.sh part1.mp4 00:03:12.5 1.8 assets/voices/hero1_attack.mp3
#          tools/cut_audio.sh part2.mp4 00:41:00 95 assets/music/battle.mp3
set -euo pipefail
movie=${1:?movie}; start=${2:?start}; dur=${3:?duration seconds}; out=${4:?output}
mkdir -p "$(dirname "$out")"
fade=$(awk -v d="$dur" 'BEGIN{f=d/10; if(f>1)f=1; print f}')
fo=$(awk -v d="$dur" -v f="$fade" 'BEGIN{print d-f}')
ffmpeg -hide_banner -loglevel error -y -ss "$start" -t "$dur" -i "$movie" -vn \
  -af "afade=t=in:d=$fade,afade=t=out:st=$fo:d=$fade,loudnorm" -ac 1 -b:a 96k "$out"
echo "Saved $out"
