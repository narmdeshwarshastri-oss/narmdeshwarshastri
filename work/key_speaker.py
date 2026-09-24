"""वक्ता की परीक्षण-स्तर keying (अन्तिम keying बाद में Resolve में)।

क्रम: कट-सूची के फ्रेम → रंग-सुधार (4K) → ffmpeg chromakey + despill (4K) →
      garbage matte + matte की सफ़ाई → किनारे 1 px नरम → हरी झलक शून्य → light wrap →
      1350x1458 (4K का 0.675 गुना) → ProRes 4444 (alpha सहित)।

उपयोग:
  python3 work/key_speaker.py test 491 1000 1500     # कुछ स्रोत-फ्रेम, PNG में
  python3 work/key_speaker.py full                    # पूरी संपादित समय-रेखा
"""
import json, subprocess, sys, time
import numpy as np
import cv2

SEG = "work/segment_4k.mov"
T = json.load(open("output/timing.json", encoding="utf-8"))
GRADE = open("work/grade_filter.txt").read().strip()
CX, CW, CH = 850, 2000, 2160          # 4K में वक्ता वाला हिस्सा (x 850-2850, पूरी ऊँचाई)
OUT_W, OUT_H = 1350, 1458             # 0.675 गुना: 135% ज़ूम पर 1:1
KEY = "0x80F3C0"                      # ग्रेड के बाद पर्दे का माध्यिका रंग (127.8, 243.4, 192.1)
SIM, BLEND = 0.088, 0.018
DESK_CUT = 2075                        # इसके नीचे मेज़/पर्दे का निचला किनारा (फ्रेम से हमेशा बाहर)

# ---------- स्थिर garbage matte (4K पूरे फ्रेम में), फिर वक्ता वाले हिस्से में काटा
gm = cv2.imread("work/garbage_matte_4k.png", cv2.IMREAD_GRAYSCALE)
gm = (gm > 127).astype(np.uint8)
# पर्दे के hull की सीधी निचली रेखा वक्ता की बाँह/हाथ काटती है: नीचे का हिस्सा बहुभुज से जोड़ा,
# जो दाहिनी ओर पर्दे के काले घेरे से 12-30 px भीतर रहता है
lower = np.array([[1000, 1650], [2760, 1650], [2572, 1878], [2412, 1985], [2372, DESK_CUT], [1000, DESK_CUT]], np.int32)
cv2.fillPoly(gm, [lower], 1)
gm[DESK_CUT:, :] = 0
GM = gm[:, CX:CX + CW].astype(np.float32)

# बालों और अँगूठी (पन्ना) के गहरे पिक्सेल key में न कटें: केवल इन दो क्षेत्रों में
HAIR_BOX = (1400 - CX, 120, 2300 - CX, 820)      # x0, y0, x1, y1 (crop-निर्देशांक)
HAND_BOX = (1250 - CX, 900, 2450 - CX, DESK_CUT)

# ---------- light wrap का स्रोत: Remotion की पृष्ठभूमि (100% ज़ूम पर वक्ता के पीछे का भाग)
bg = cv2.imread("work/work_bgplate.png", cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.float32) / 255.0
FACE4K = (1830, 500)
SCREEN_ANCHOR = (1392, 300)
x0 = SCREEN_ANCHOR[0] + (CX - FACE4K[0]) * 0.5
y0 = SCREEN_ANCHOR[1] - FACE4K[1] * 0.5
bgpad = cv2.copyMakeBorder(bg, 0, 200, 0, 200, cv2.BORDER_REPLICATE)
sub = bgpad[int(y0):int(y0) + CH // 2, int(x0):int(x0) + CW // 2]
WRAP_SRC_S = cv2.GaussianBlur(cv2.resize(sub, (OUT_W, OUT_H), interpolation=cv2.INTER_CUBIC), (0, 0), 27)


def ffmpeg_reader(select_expr):
    fc = (
        f"[0:v]select='{select_expr}',setpts=N/25/TB,crop={CW}:{CH}:{CX}:0,{GRADE},split[g1][g2];"
        f"[g1]scale=out_color_matrix=bt601:out_range=tv,format=yuva444p16le,"
        f"chromakey=color={KEY}:similarity={SIM}:blend={BLEND},despill=type=green:mix=0.5:expand=0,format=rgba[k];"
        f"[g2]format=rgba[g];[k][g]hstack=inputs=2,format=rgba[out]"
    )
    cmd = ["ffmpeg", "-v", "error", "-i", SEG, "-filter_complex", fc, "-map", "[out]",
           "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=CW * 2 * CH * 4 * 2)


def smooth_step(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def uv_dist(g):
    """chromakey जैसी BT.601 UV-दूरी (0-1), key-रंग से"""
    R, G, B = g[..., 0], g[..., 1], g[..., 2]
    U = 224 * (-0.168736 * R - 0.331264 * G + 0.5 * B)
    V = 224 * (0.5 * R - 0.418688 * G - 0.081312 * B)
    return np.sqrt((U - KEY_UV[0]) ** 2 + (V - KEY_UV[1]) ** 2) / (255 * np.sqrt(2))


_k = np.array([int(KEY[2:4], 16), int(KEY[4:6], 16), int(KEY[6:8], 16)], np.float32) / 255.0
KEY_UV = (224 * (-0.168736 * _k[0] - 0.331264 * _k[1] + 0.5 * _k[2]),
          224 * (0.5 * _k[0] - 0.418688 * _k[1] - 0.081312 * _k[2]))
ELL5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
ELL_HAIR = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
# बालों वाले क्षेत्र का नरम भार (किनारों पर धीरे-धीरे 0)
HAIR_W = np.zeros((CH, CW), np.float32)
HAIR_W[HAIR_BOX[1]:HAIR_BOX[3], HAIR_BOX[0]:HAIR_BOX[2]] = 1
HAIR_W = cv2.GaussianBlur(HAIR_W, (0, 0), 25)

# दीपक का भाव: चेहरा सबसे उजला, नीचे और बायीं ओर (दीपक से दूर) 5-16% हल्की गिरावट
_yy, _xx = np.mgrid[0:OUT_H, 0:OUT_W].astype(np.float32)
_r = np.sqrt(((_xx - 661) / 900) ** 2 + ((_yy - 420) / 1100) ** 2)
_t = np.clip((_r - 0.35) / 0.65, 0, 1)
RELIGHT = (1 - 0.16 * _t * _t * (3 - 2 * _t) - 0.05 * (1 - _xx / OUT_W))[..., None].astype(np.float32)


def process(buf):
    fr = np.frombuffer(buf, np.uint8).reshape(CH, CW * 2, 4)
    k = fr[:, :CW].astype(np.float32) * (1 / 255.0)     # despill के बाद + chromakey alpha
    g = fr[:, CW:, :3].astype(np.float32) * (1 / 255.0) # ग्रेड के बाद, despill से पहले
    a = k[..., 3] * GM
    luma = 0.2126 * g[..., 0] + 0.7152 * g[..., 1] + 0.0722 * g[..., 2]

    # 1) बाल और अँगूठी: गहरे पिक्सेल अपारदर्शी (केवल दो क्षेत्रों में)
    x0_, y0_, x1_, y1_ = HAIR_BOX
    a[y0_:y1_, x0_:x1_] = np.maximum(a[y0_:y1_, x0_:x1_], 1 - smooth_step(luma[y0_:y1_, x0_:x1_], 0.50, 0.57))
    x0_, y0_, x1_, y1_ = HAND_BOX
    a[y0_:y1_, x0_:x1_] = np.maximum(a[y0_:y1_, x0_:x1_], 1 - smooth_step(luma[y0_:y1_, x0_:x1_], 0.36, 0.43))
    a *= GM

    # 2) कुर्ते में हरी झलक से बने छोटे छेद भरें, पर वहीं जहाँ पिक्सेल साफ़-साफ़ पर्दे का रंग नहीं है
    #    (बाँह और शरीर के बीच दिखता असली पर्दा पारदर्शी ही रहे)
    solid = (a > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(1 - solid, 8)
    small = np.zeros(n, bool)
    small[1:] = st[1:, cv2.CC_STAT_AREA] < 4000
    holes = small[lab]
    if holes.any():
        d = uv_dist(g)
        a = np.where(holes & (d > 0.075) & (GM > 0), 1.0, a)
    # अकेले तैरते धब्बे (2000 px से छोटे अपारदर्शी टुकड़े) हटाएँ
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(solid, 8)
    sp = np.zeros(n2, bool)
    sp[1:] = st2[1:, cv2.CC_STAT_AREA] < 2000
    a = np.where(sp[lab2], 0.0, a)

    # पन्ना: हाथ-क्षेत्र में अपारदर्शी हिस्से के भीतर का गहरा-हरा पत्थर (मूल रंग में लौटेगा)
    inner = cv2.erode((a > 0.9).astype(np.uint8), ELL5)
    gem = np.zeros((CH, CW), np.float32)
    x0_, y0_, x1_, y1_ = HAND_BOX
    gs = g[y0_:y1_, x0_:x1_]
    mx, mn = gs.max(2), gs.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    greenish = (gs[..., 1] > gs[..., 0]) & (sat > 0.22) & (luma[y0_:y1_, x0_:x1_] < 0.60)
    gem[y0_:y1_, x0_:x1_] = (greenish & (inner[y0_:y1_, x0_:x1_] > 0)).astype(np.float32)

    # 3) किनारों पर नरमी (4K पर): सामान्य 1 px; बालों के क्षेत्र में पहले छोटे छेद बन्द, फिर 2 px
    x0_, y0_, x1_, y1_ = HAIR_BOX
    hair = a[y0_:y1_, x0_:x1_]
    hair = cv2.morphologyEx(hair, cv2.MORPH_CLOSE, ELL_HAIR)
    a1 = cv2.GaussianBlur(a, (0, 0), 1.0)
    a[y0_:y1_, x0_:x1_] = hair
    a2 = cv2.GaussianBlur(a, (0, 0), 2.0)
    a = np.clip(a1 * (1 - HAIR_W) + a2 * HAIR_W, 0, 1)

    # 4) premultiplied रूप में 0.675 गुना छोटा; रंग के बाकी काम इसी आकार पर
    def down(img):
        return cv2.resize(img, (OUT_W, OUT_H), interpolation=cv2.INTER_AREA)
    a3 = a[..., None]
    rgbp = down(k[..., :3] * a3)
    gp = down(g * a3)
    al = down(a)[..., None]
    gemd = cv2.GaussianBlur(down(gem), (0, 0), 0.8)[..., None]
    inv = 1 / np.maximum(al, 1e-4)
    rgb = np.clip(rgbp * inv, 0, 1)
    gcol = np.clip(gp * inv, 0, 1)

    # 5) हरी झलक शून्य: despill के बाद भी बचा हरा/हल्का नीला (बाल, किनारे) तटस्थ
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s = hsv[..., 0], hsv[..., 1]
    # hue 75-250°: despill के बाद हरा-नीला/नीला बचा रंग भी (बालों पर नीली झलक)
    spill = (((h > 75) & (h < 250)).astype(np.float32) * (1 - smooth_step(s, 0.28, 0.40)))[..., None] * 0.85
    gray = rgb[..., 0:1] * 0.30 + rgb[..., 1:2] * 0.59 + rgb[..., 2:3] * 0.11
    rgb = rgb * (1 - spill) + gray * spill
    # नीले-हरे पर्दे पर despill के बाद किनारों/बालों में नीली धार बचती है: नीला R/G से ऊपर न जाए
    rgb[..., 2] = np.minimum(rgb[..., 2], np.maximum(rgb[..., 0], rgb[..., 1]) + 0.015)
    # वक्ता पर कोई असली हरी/नीली वस्तु नहीं (पन्ना अलग से लौटता है): G और B, R से 0.02 से अधिक नहीं
    rgb[..., 1] = np.minimum(rgb[..., 1], rgb[..., 0] + 0.02)
    rgb[..., 2] = np.minimum(rgb[..., 2], rgb[..., 0] + 0.02)
    rgb = rgb * (1 - gemd) + gcol * gemd          # पन्ना का मूल रंग

    rgb = rgb * RELIGHT

    # 6) light wrap: पृष्ठभूमि की रोशनी वक्ता के किनारों के भीतर हल्की-सी
    band = al[..., 0] * (1 - cv2.GaussianBlur(al[..., 0], (0, 0), 9.5))
    wrap = WRAP_SRC_S * (band[..., None] * 1.6)
    rgb = 1 - (1 - rgb) * (1 - np.clip(wrap, 0, 1))
    out = np.dstack([np.clip(rgb, 0, 1), np.clip(al, 0, 1)])
    return out, (rgb, al[..., 0])


def select_for_frames(frames):
    return "+".join(f"eq(n,{f})" for f in frames)


def select_kept():
    return "+".join(f"between(n,{a},{b})" for a, b in T["kept_src_frames"])


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "test":
        frames = [int(x) for x in sys.argv[2:]]
        rd = ffmpeg_reader(select_for_frames(frames))
        for f in frames:
            buf = rd.stdout.read(CW * 2 * CH * 4)
            t0 = time.time()
            out, (rgb4k, a4k) = process(buf)
            print("frame", f, "process %.2fs" % (time.time() - t0))
            o16 = (out * 65535).astype(np.uint16)
            cv2.imwrite(f"work/colortest/key_{f}.png", cv2.cvtColor(o16, cv2.COLOR_RGBA2BGRA))
        rd.wait()
    else:
        part, nparts = int(sys.argv[2]), int(sys.argv[3])
        src = [f for a, b in T["kept_src_frames"] for f in range(a, b + 1)]
        per = (len(src) + nparts - 1) // nparts
        mine = src[part * per:(part + 1) * per]
        # लगातार टुकड़ों में बाँटकर select
        rngs, st = [], mine[0]
        for i in range(1, len(mine) + 1):
            if i == len(mine) or mine[i] != mine[i - 1] + 1:
                rngs.append((st, mine[i - 1]))
                if i < len(mine):
                    st = mine[i]
        sel = "+".join(f"between(n,{a},{b})" for a, b in rngs)
        out_path = f"work/speaker_part{part}.mov"
        rd = ffmpeg_reader(sel)
        wr = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba64le", "-s", f"{OUT_W}x{OUT_H}",
             "-r", "25", "-i", "pipe:0", "-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le",
             "-alpha_bits", "16", "-vendor", "apl0", "-color_primaries", "bt709", "-color_trc", "bt709",
             "-colorspace", "bt709", out_path],
            stdin=subprocess.PIPE)
        n, t0 = 0, time.time()
        while True:
            buf = rd.stdout.read(CW * 2 * CH * 4)
            if len(buf) < CW * 2 * CH * 4:
                break
            out, _ = process(buf)
            wr.stdin.write((out * 65535).astype(np.uint16).tobytes())
            n += 1
            if n % 50 == 0:
                el = time.time() - t0
                print(f"[{part}] {n}/{len(mine)} फ्रेम, {el:.0f}s, बाकी ~{el / n * (len(mine) - n):.0f}s", flush=True)
        wr.stdin.close()
        wr.wait()
        rd.wait()
        print(f"[{part}] done", n, "frames ->", out_path, flush=True)
