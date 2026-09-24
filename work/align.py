"""शब्द-समय को ऑडियो की मौन-सीमाओं से मिलाकर output/timing.json बनाता है।

स्रोत-समय = मूल फ़ाइल (रॉ) का समय। संपादित-समय = कट-सूची लगाने के बाद का समय।
"""
import json, re, subprocess

FPS = 25
AUDIO = "work/hook_audio_48k.wav"
ASR = "work/asr_medium_hook.jsonl"

# ---- 1. मौन-अन्तराल (ffmpeg silencedetect, -35 dB, कम से कम 0.25 s)
out = subprocess.run(["ffmpeg", "-hide_banner", "-i", AUDIO, "-af",
                      "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", out)]
ends = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", out)]
silences = list(zip(starts, ends))

# ---- 2. शब्द (faster-whisper medium, word timestamps) को मौन-सीमा पर कसना
words = []
for line in open(ASR, encoding="utf-8"):
    for w in json.loads(line)["words"]:
        words.append({"w": w["w"].strip(), "s": w["s"], "e": w["e"]})
MIN_WORD = 0.12
for k, w in enumerate(words):
    nxt = words[k + 1]["s"] if k + 1 < len(words) else 99.0
    for a, b in silences:
        if a <= w["s"] < b:
            # आरम्भ मौन में पड़ा: मौन के बाद जगह हो तो शब्द मौन के बाद है, नहीं तो मौन से पहले
            if nxt - b >= (0.05 if len(w["w"].strip(",.?।")) <= 2 else MIN_WORD):
                w["s"] = b
            else:
                w["e"] = a
                w["s"] = min(w["s"], a - 0.15)
        elif w["s"] < a < w["e"]:
            # शब्द मौन के आरम्भ तक ही है (whisper शब्द को ठहराव में खींच देता है)
            w["e"] = a
    if k > 0 and words[k - 1]["e"] > w["s"]:
        words[k - 1]["e"] = w["s"]
# ठहराव के बाद का पहला शब्द, यदि 0.12 s के भीतर शुरू हो, मौन के अन्त से ही शुरू होता है
for a, b in silences:
    first = next((w for w in words if w["s"] >= b - 0.001), None)
    if first is not None and 0 < first["s"] - b <= 0.12:
        first["s"] = b
for w in words:
    w["s"], w["e"] = round(w["s"], 3), round(max(w["e"], w["s"] + 0.04), 3)

# ---- 3. कट-सूची (हटाए गए अन्तराल, स्रोत-समय, फ्रेम-सीमा पर)
HEAD = 9.64            # पहला शब्द "गरुड़" 9.757 s पर; 3 फ्रेम पहले से आरम्भ
SPEECH_END = 65.21     # अन्तिम शब्द "जाए" का अन्त (मौन 65.21 से)
TAIL = SPEECH_END + 3.0 + 1.0 + 0.03   # 3 s ठहराव + 1 s काले में फेड
REMOVE = [  # (आरम्भ, अन्त, कारण)
    (0.0, HEAD, "शुरू का खाली हिस्सा (कैमरा चालू, बोलना 9.76 s से); विडियो पहले शब्द 'गरुड़' से"),
    (16.60, 16.80, "'डरते हैं' के बाद वाक्य-सीमा का मौन 1.05 s → 0.85 s (बड़ी बात के बाद का ठहराव 0.8-1.0 में)"),
    (21.52, 22.20, "प्रश्न '...लिखा क्या है?' के बाद मौन 1.65 s → 0.97 s (बड़ी बात के बाद का ठहराव)"),
    (26.08, 26.56, "'18 पुराणों में से एक' के बाद उपवाक्य-सीमा का मौन 0.87 s → 0.39 s"),
    (30.20, 30.40, "'बस मौत की किताब है' के बाद मौन 1.09 s → 0.89 s (बड़ी बात, हल्का ठहराव)"),
]


def to_edit(t):
    """स्रोत-समय → संपादित-समय"""
    if t < HEAD:
        return 0.0
    d = t - HEAD
    for a, b, _ in REMOVE[1:]:
        if t >= b:
            d -= (b - a)
        elif t > a:
            d -= (t - a)
    return round(d, 3)


def find(phrase_first, after=0.0):
    """किसी शब्द का पहला मिलान (after के बाद)"""
    for i, w in enumerate(words):
        if w["s"] >= after and w["w"].strip(",.?।") == phrase_first:
            return i
    raise KeyError(phrase_first)


def span(i, j):
    return words[i]["s"], words[j]["e"]


# ---- 4. उपयोगकर्ता के दिए वाक्य (शुद्ध पाठ) और उनके शब्द-सूचकांक
sent_defs = [
    ("S1", "गरुड़ पुराण, जिस किताब को लोग अपने घर में रखने से भी डरते हैं। आपने कभी सोचा है कि उसके भीतर आखिर लिखा क्या है?", "0:07", 0, 24),
    ("S2", "गरुड़ पुराण 18 पुराणों में से एक, और लोग समझते हैं कि यह बस मौत की किताब है।", "0:20", 25, 42),
    ("S3", "घर में कोई चला जाए तो 13 दिन सुन लो और फिर बन्द करके रख दो। पर सच यह है कि इस पूरी किताब का बहुत छोटा सा हिस्सा मृत्यु पर है।", "0:28", 43, 73),
    ("S4", "बाकी में रत्नों की पहचान है। आयुर्वेद है। ग्रह, नक्षत्र और मुहूर्त का पूरा ज्योतिष है।", "0:37", 74, 88),
    ("S5", "और जो हिस्सा मृत्यु पर है, वह भी डराने के लिए नहीं लिखा गया। वह इसलिए लिखा गया ताकि हमें पता रहे कि जो जा रहा है, उसका साथ आखिर तक कैसे दिया जाए।", "0:51", 89, 122),
]
sentences = []
for sid, text, given, i, j in sent_defs:
    s, e = span(i, j)
    sentences.append({"id": sid, "text": text, "given_time_published": given,
                      "src_start": s, "src_end": e,
                      "edit_start": to_edit(s), "edit_end": to_edit(e),
                      "asr_words": " ".join(w["w"] for w in words[i:j + 1])})

# ---- 5. ग्राफिक्स के संकेत-शब्द (हर संकेत: पहला शब्द का आरम्भ, अन्तिम शब्द का अन्त)
cue_defs = [
    ("title_garud_puran", "गरुड़ पुराण", 0, 1),
    ("dar_punch", "डरते हैं", 12, 13),
    ("dar_keyword", "घर में रखने से भी डरते हैं", 7, 13),
    ("question", "उसके भीतर आखिर लिखा क्या है?", 19, 24),
    ("n18", "18 पुराणों में से एक", 27, 31),
    ("maut_band", "बस मौत की किताब है", 38, 42),
    ("din13", "13 दिन", 49, 50),
    ("phir_band", "फिर बन्द", 54, 55),
    ("sach", "पर सच यह है", 59, 61),
    ("bar_small_part", "बहुत छोटा सा हिस्सा मृत्यु पर है", 67, 73),
    ("card_ratna", "रत्नों की पहचान", 76, 78),
    ("card_ayurved", "आयुर्वेद", 80, 80),
    ("card_jyotish", "ग्रह, नक्षत्र और मुहूर्त का पूरा ज्योतिष", 82, 87),
    ("darane_nahin", "डराने के लिए नहीं लिखा गया", 97, 102),
    ("final_line", "जो जा रहा है, उसका साथ आखिर तक कैसे दिया जाए", 112, 122),
]
cues = []
for cid, text, i, j in cue_defs:
    s, e = span(i, j)
    cues.append({"id": cid, "text": text, "src_start": s, "src_end": e,
                 "edit_start": to_edit(s), "edit_end": to_edit(e),
                 "edit_start_frame": round(to_edit(s) * FPS), "edit_end_frame": round(to_edit(e) * FPS)})

total = to_edit(TAIL)
timing = {
    "note": "src_* = मूल रॉ फ़ाइल 'गरुण पुराण मृत्यु नहीं जीवन की किताब.MP4' का समय (सेकंड)। "
            "edit_* = कट लगने के बाद का समय। प्रकाशित विडियो के समय (0:07 आदि) रॉ से लगभग 2.7 s पीछे हैं; "
            "रॉ में पहला शब्द 9.757 s पर है। शब्द-समय faster-whisper (medium) के शब्द-समय को ffmpeg silencedetect "
            "(-35 dB, 0.25 s) की सीमाओं पर कसकर निकाले गए।",
    "fps": FPS,
    "src_head": HEAD, "src_speech_end": SPEECH_END, "src_tail": round(TAIL, 3),
    "edit_speech_end": to_edit(SPEECH_END), "edit_duration": round(total, 3),
    "edit_duration_frames": int(round(total * FPS)),
    "removed": [{"src_start": a, "src_end": b, "dur": round(b - a, 3), "reason": r} for a, b, r in REMOVE],
    "cut_points_edit": [{"src": a, "edit": to_edit(a), "frame": int(round(to_edit(a) * FPS))} for a, b, r in REMOVE[1:]],
    "kept_src_frames": [],
    "sentences": sentences,
    "cues": cues,
    "words": [{"w": w["w"], "src_start": w["s"], "src_end": w["e"], "edit_start": to_edit(w["s"])} for w in words],
    "silences_src": [[round(a, 3), round(b, 3)] for a, b in silences],
}
kept = []
cur = HEAD
for a, b, _ in REMOVE[1:]:
    kept.append((cur, a)); cur = b
kept.append((cur, TAIL))
timing["kept_src_frames"] = [[int(round(a * FPS)), int(round(b * FPS)) - 1] for a, b in kept]
timing["kept_frames_total"] = sum(b - a + 1 for a, b in timing["kept_src_frames"])
json.dump(timing, open("output/timing.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for s in sentences:
    print(s["id"], s["src_start"], s["src_end"], "→", s["edit_start"], s["edit_end"], "|", s["asr_words"][:60])
for c in cues:
    print(f'{c["id"]:18s} src {c["src_start"]:6.2f}-{c["src_end"]:6.2f}  edit {c["edit_start"]:6.2f} (f{c["edit_start_frame"]})')
print("duration", total, "frames", int(round(total * FPS)))
