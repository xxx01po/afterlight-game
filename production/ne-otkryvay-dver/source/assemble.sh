#!/usr/bin/env bash
# usage: assemble.sh video_raw.mp4 mix.wav out_dir
set -euo pipefail
RAW=$1; MIX=$2; OUT=$3; mkdir -p "$OUT"
GL="between(t,12.88,13.05)+between(t,14.55,14.85)+between(t,15.05,15.2)+between(t,20.6,20.72)+between(t,22.08,22.2)+between(t,22.43,22.5)"
VF="eq=contrast=1.06:saturation=0.92:gamma=0.98,colorbalance=bs=0.06:bm=0.03:rh=0.02,vignette=angle=PI/4.5,rgbashift=rh=7:bh=-7:enable='$GL',noise=alls=7:allf=t,format=yuv420p"
AF="acompressor=threshold=-22dB:ratio=3:attack=5:release=150:makeup=2,loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000"
ffmpeg -y -v error -i "$RAW" -i "$MIX" -vf "$VF" -af "$AF" -c:v libx264 -preset slow -crf 16 -profile:v high -r 30 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$OUT/ne_otkryvay_dver_1080x1920.mp4"
ffmpeg -y -v error -i "$RAW" -vf "$VF" -an -c:v libx264 -preset slow -crf 16 -r 30 -movflags +faststart "$OUT/ne_otkryvay_dver_video_only.mp4"
echo done
