#!/bin/bash
# Remotion के PNG फ्रेम + अन्तिम ध्वनि-मिश्रण → output/hook_final.mp4 और output/hook_review.mp4
# 1080p पर हल्का unsharp (लगभग 1 px), फिर 3-4% film grain, फिर bt709 में H.264
set -e
cd /home/user/narmdeshwarshastri
FR=work/out_frames
OUT=${1:-output}
mkdir -p "$OUT"
# पहले bt709 (limited) YUV 4:4:4 में, फिर केवल luma पर unsharp (3x3 ≈ 1 px, 0.45) और luma-grain
# noise c0s=8, t+u: हर फ्रेम बदलता, ±8 स्तर (219 स्तरों का ≈ ±3.7%); रंगीन धब्बे नहीं
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv444p,unsharp=3:3:0.45:3:3:0,noise=c0s=8:c0f=t+u,format=yuv420p"
ffmpeg -v error -y -framerate 25 -i "$FR/frame-%04d.png" -i work/mix_final.wav \
  -vf "$VF" \
  -c:v libx264 -preset slow -profile:v high -level:v 4.2 -b:v 18M -maxrate 20M -bufsize 36M \
  -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest \
  "$OUT/hook_final.mp4"

# समीक्षा-प्रति: ऊपर बायें जला हुआ समय-कोड, कम बिटरेट
ffmpeg -v error -y -i "$OUT/hook_final.mp4" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf:timecode='00\:00\:00\:00':rate=25:x=28:y=24:fontsize=40:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=10" \
  -c:v libx264 -preset medium -b:v 3M -maxrate 4M -bufsize 8M \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 128k -movflags +faststart "$OUT/hook_review.mp4"
echo finalize-done
