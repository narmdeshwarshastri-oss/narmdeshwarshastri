"""कट-सूची से संवाद-ट्रैक बनाना: हर कट पर 2 फ्रेम (80 ms) का equal-power क्रॉसफेड।

इनपुट: work/hook_audio_48k.wav (रॉ 0-75 s, 48 kHz, 24-bit)
आउटपुट: work/dialog_edit.wav (संपादित समय-रेखा, ठीक 1451 फ्रेम = 58.04 s)
"""
import json
import numpy as np
import soundfile as sf

T = json.load(open("output/timing.json", encoding="utf-8"))
FPS = T["fps"]
x, sr = sf.read("work/hook_audio_48k.wav", always_2d=True)
x = x.astype(np.float64)

kept = [(a / FPS, (b + 1) / FPS) for a, b in T["kept_src_frames"]]  # स्रोत-सेकंड
XF = 2 / FPS                     # 80 ms
half = XF / 2
n_total = int(round(T["edit_duration_frames"] / FPS * sr))
out = np.zeros((n_total, x.shape[1]))

pos = 0.0  # संपादित समय-रेखा में इस टुकड़े का आरम्भ (सेकंड)
for i, (a, b) in enumerate(kept):
    # हर जोड़ पर दोनों ओर 40 ms बढ़ाकर ओवरलैप; जोड़ मौन में है, इसलिए कोई शब्द नहीं दोहराता
    ea = a - half if i > 0 else a
    eb = b + half if i < len(kept) - 1 else b
    seg = x[int(round(ea * sr)):int(round(eb * sr))].copy()
    n = len(seg)
    env = np.ones(n)
    nx = int(round(XF * sr))
    t = np.linspace(0, np.pi / 2, nx)
    if i > 0:
        env[:nx] = np.sin(t)            # equal-power fade-in
    else:
        env[:nx] = np.sin(t)            # पहले शब्द से पहले 2 फ्रेम का fade-in
    if i < len(kept) - 1:
        env[-nx:] = np.cos(t)           # equal-power fade-out
    seg *= env[:, None]
    start = int(round((pos - (half if i > 0 else 0)) * sr))
    end = min(start + n, n_total)
    out[start:end] += seg[: end - start]
    pos += b - a

# अन्त: अन्तिम शब्द 'जाए' के बाद 0.30 s में आवाज़-ट्रैक बन्द (रॉ में 1:06.86 से 'नमस्कार' है, वह नहीं आना चाहिए)
speech_end = T["edit_speech_end"]
f0 = int(round((speech_end + 0.05) * sr))
f1 = int(round((speech_end + 0.35) * sr))
fade = np.cos(np.linspace(0, np.pi / 2, f1 - f0)) ** 2
out[f0:f1] *= fade[:, None]
out[f1:] = 0.0

sf.write("work/dialog_edit.wav", out.astype(np.float32), sr, subtype="FLOAT")
print("dialog_edit.wav", n_total / sr, "s", "peak", 20 * np.log10(np.abs(out).max() + 1e-12), "dBFS")

# जाँच: हर जोड़ के आसपास का स्तर (मौन होना चाहिए)
for c in T["cut_points_edit"]:
    k = int(round(c["edit"] * sr))
    w = out[max(0, k - 2400):k + 2400]
    print(f"जोड़ {c['edit']:.2f}s: RMS {20*np.log10(np.sqrt((w**2).mean())+1e-12):.1f} dBFS")
