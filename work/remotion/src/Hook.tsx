import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Background } from "./components/Background";
import { Speaker, zoomAt, ZoomKey, FACE_ON_SCREEN } from "./components/Speaker";
import { BandText, BookBar, CardQueue, FinalLine, GoldTitle, KeywordText, QuestionFull } from "./components/Texts";
import { C, FPS } from "./theme";
import timing from "./data/timing.json";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// timing.json से किसी संकेत का पहला फ्रेम (संपादित समय-रेखा)
const cue = (id: string) => {
  const c = timing.cues.find((x) => x.id === id);
  if (!c) throw new Error("cue नहीं मिला: " + id);
  return { start: c.edit_start_frame, end: c.edit_end_frame };
};
const word = (w: string, afterSec: number) => {
  const x = timing.words.find((y) => y.w.replace(/[,.?।]/g, "") === w && y.edit_start >= afterSec);
  if (!x) throw new Error("शब्द नहीं मिला: " + w);
  return Math.round(x.edit_start * FPS);
};
const cutF = timing.cut_points_edit.map((c) => c.frame); // [174, 292, 389, 480]
const LEAD = 2; // पाठ बोले गए शब्द से 2 फ्रेम पहले

// ---- मुख्य संकेत (फ्रेम)
const F = {
  title: Math.max(1, cue("title_garud_puran").start - LEAD),
  dar: cue("dar_keyword").start - LEAD, // "घर"
  darPunch: cue("dar_punch").start - LEAD, // "डरते"
  q: cue("question").start - LEAD, // "उसके"
  qLine2: word("आखिर", 9.5) - LEAD,
  s2: Math.round(timing.sentences[1].edit_start * FPS), // "गरुड़ पुराण 18 पुराणों..."
  n18: cue("n18").start - LEAD,
  samajh: word("और", 15.0) - LEAD, // "और लोग समझते हैं"
  maut: cue("maut_band").start - LEAD,
  s3: Math.round(timing.sentences[2].edit_start * FPS), // "घर में कोई चला जाए"
  din13: cue("din13").start - LEAD,
  phir: cue("phir_band").start - LEAD,
  sach: cue("sach").start - LEAD,
  bar: cue("bar_small_part").start - LEAD,
  baaki: Math.round(timing.sentences[3].edit_start * FPS) - LEAD,
  ratna: cue("card_ratna").start - LEAD,
  ayur: cue("card_ayurved").start - LEAD,
  jyot: cue("card_jyotish").start - LEAD,
  darane: cue("darane_nahin").start - LEAD,
  final: word("कि", 49.0) - LEAD, // "कि जो जा रहा है"
  finalL2: word("उसका", 50.5) - LEAD,
  speechEnd: Math.round(timing.edit_speech_end * FPS),
  total: timing.edit_duration_frames,
};
const HOLD_END = F.speechEnd + 3 * FPS; // बोलना खत्म होने के बाद 3 सेकंड ठहराव
const BLACK_END = HOLD_END + FPS; // फिर 1 सेकंड में काला

// ---- ज़ूम-योजना: केवल 100 / 115 / 135; हर कट पर कम से कम 10% बदलाव; कोई आकार 12 s से ज्यादा नहीं
const ZOOM: ZoomKey[] = [
  { f: 0, z: 1.0 },
  { f: F.darPunch, z: 1.35, dur: 5 }, // "डरते हैं" पर पंच-इन
  { f: cutF[0], z: 1.15 }, // कट 1
  { f: cutF[1], z: 1.0 }, // कट 2 (वक्ता प्रश्न के पीछे छिपा है)
  { f: cutF[2], z: 1.15 }, // कट 3
  { f: cutF[3], z: 1.0 }, // कट 4
  { f: F.sach, z: 1.35, dur: 5 }, // "पर सच यह है" पर पंच-इन
  { f: F.baaki, z: 1.15, dur: 8 },
  { f: F.darane, z: 1.0, dur: 20 }, // "डराने के लिए नहीं": ज़ूम-आउट, चौड़ा फ्रेम
];

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const z = zoomAt(f, ZOOM);
  const bgZoom = 1 + 0.65 * (z - 1); // पृष्ठभूमि वक्ता के ज़ूम का 65%

  // पूरे पर्दे वाले क्षणों में वक्ता छिपता है
  const qHide = interpolate(f, [F.q - 4, F.q + 4, F.s2 - 8, F.s2], [1, 0, 0, 1], clamp);
  const finalHide = interpolate(f, [F.final - 6, F.final + 8], [1, 0], clamp);
  const speakerOpacity = Math.min(qHide, finalHide);
  // "डराने के लिए नहीं": राहत, दीपक की रोशनी हल्की उभरे
  const relief = interpolate(f, [F.darane, F.darane + 30, F.final, F.final + 10], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      <Background zoom={bgZoom} anchorX={FACE_ON_SCREEN.x} anchorY={FACE_ON_SCREEN.y} glowBoost={relief} />
      <Speaker zoom={z} opacity={speakerOpacity} />

      {/* 1. गरुड़ पुराण */}
      <GoldTitle start={F.title} end={F.dar - 1} />

      {/* 2. "घर में रखने से भी" फिर "डरते हैं" (6 शब्द की सीमा के कारण दो चरण) */}
      <KeywordText
        start={F.dar}
        end={F.darPunch}
        y={400}
        size={104}
        lines={[[{ t: "घर में रखने से भी" }]]}
      />
      <KeywordText
        start={F.darPunch}
        end={F.q - 8}
        y={372}
        size={150}
        lines={[[{ t: "डरते", color: C.gold }, { t: "हैं" }]]}
      />

      {/* 3. पूरे पर्दे पर प्रश्न */}
      <QuestionFull start={F.q} line2At={F.qLine2} end={F.s2 - 2} />

      {/* 4. 18 पुराणों में से एक */}
      <KeywordText
        start={F.n18}
        end={F.samajh + 10}
        y={390}
        size={112}
        lines={[[{ t: "18", font: "poppins", color: C.gold, scale: 1.3 }, { t: "पुराणों में से एक" }]]}
      />

      {/* 5. बस मौत की किताब है: रजत पट्टी */}
      <BandText start={F.maut} end={F.s3 - 1} text="बस मौत की किताब है" y={450} />

      {/* 6. 13 दिन, फिर बन्द */}
      <KeywordText
        start={F.din13}
        end={F.sach - 4}
        y={400}
        size={120}
        lines={[
          [
            { t: "13", font: "poppins", color: C.gold, scale: 1.15 },
            { t: "दिन," },
            { t: "फिर बन्द", at: F.phir },
          ],
        ]}
      />

      {/* 7. बहुत छोटा सा हिस्सा मृत्यु पर है */}
      <BookBar start={F.bar} end={F.baaki + 4} deathShare={0.1} />

      {/* 8. कार्ड-कतार */}
      <CardQueue
        cards={[
          { lines: ["रत्नों की", "पहचान"], at: F.ratna },
          { lines: ["आयुर्वेद"], at: F.ayur },
          { lines: ["ग्रह, नक्षत्र, मुहूर्त", "का ज्योतिष"], at: F.jyot },
        ]}
        exitAll={F.darane + 10}
      />

      {/* 10. अन्तिम पंक्ति, 3 s ठहराव, 1 s में काला */}
      <FinalLine start={F.final} line2At={F.finalL2} fadeStart={HOLD_END} end={BLACK_END} />
    </AbsoluteFill>
  );
};

export const HOOK_FRAMES = F;
export const HOOK_ZOOM = ZOOM;
