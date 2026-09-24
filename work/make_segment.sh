#!/bin/bash
# मूल फ़ाइल (Drive से range-requests द्वारा उतारी गई स्थानीय प्रति) से 0:00-1:12, ProRes 422 HQ
SRC=/tmp/claude-0/-home-user-narmdeshwarshastri/c559f17d-c341-5673-83d0-c53cd43527a8/scratchpad/video/garud_raw_sparse.MP4
ffmpeg -v error -y -ss 0 -t 72 -i "$SRC" -map 0:v:0 -map 0:a:0 \
  -c:v prores_ks -profile:v 3 -vendor apl0 -pix_fmt yuv422p10le \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a pcm_s16le -timecode 20:08:47:13 work/segment_4k.mov
