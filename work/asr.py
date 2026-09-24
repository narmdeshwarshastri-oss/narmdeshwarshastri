import sys, json, time
from faster_whisper import WhisperModel
model_name, wav, out = sys.argv[1], sys.argv[2], sys.argv[3]
offset = float(sys.argv[4]) if len(sys.argv)>4 else 0.0
m = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=4)
t=time.time()
segs, info = m.transcribe(wav, language="hi", beam_size=5, word_timestamps=True, vad_filter=False,
    initial_prompt="गरुड़ पुराण, पितृ पक्ष, श्राद्ध, तर्पण, पिंड, दशगात्र, सपिंडीकरण, प्रेत, पितर, यमराज, चित्रगुप्त, वैतरणी, सौम्यपुर।")
res=[]
with open(out,"w") as f:
    for s in segs:
        d={"start":round(s.start+offset,2),"end":round(s.end+offset,2),"text":s.text.strip(),
           "words":[{"s":round(w.start+offset,2),"e":round(w.end+offset,2),"w":w.word} for w in (s.words or [])]}
        f.write(json.dumps(d,ensure_ascii=False)+"\n"); f.flush()
print("done in", time.time()-t)
