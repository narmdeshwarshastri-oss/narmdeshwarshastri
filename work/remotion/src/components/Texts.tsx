import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { easeIn, easeInOut, easeOut, enterExit, lerp, wipeMask } from "../anim";
import { anekStyle, martelStyle, muktaStyle, poppinsStyle } from "../fonts";
import { C, goldBloom, goldFill, mix, softShadow } from "../theme";
import { Particles } from "./Background";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// पाठ के पीछे नरम गहरी छाया-पट्टी (धुँधला दीर्घवृत्त)
const Scrim: React.FC<{ w: number; h: number; opacity: number; x?: number; y?: number }> = ({ w, h, opacity, x = 0, y = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: x - w * 0.12,
      top: y - h * 0.22,
      width: w * 1.24,
      height: h * 1.44,
      borderRadius: "50%",
      background: "radial-gradient(ellipse at center, rgba(11,16,32,0.72) 0%, rgba(11,16,32,0.42) 55%, rgba(11,16,32,0) 75%)",
      filter: "blur(18px)",
      opacity,
    }}
  />
);

// background-clip:text में अक्षर का जो हिस्सा तत्व के box से बाहर हो (जैसे रेफ़ ्र, ऊपर की मात्राएँ),
// वह रंगा नहीं जाता: इसलिए ऊपर-नीचे padding, और उतना ही negative margin
const goldText: React.CSSProperties = {
  backgroundImage: goldFill,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  paddingTop: "0.32em",
  marginTop: "-0.32em",
  // दायें-बायें भी जगह: अक्षर का बाहर निकला हिस्सा और bloom mask के भीतर रहें
  paddingLeft: "0.3em",
  paddingRight: "0.3em",
  marginLeft: "-0.3em",
  marginRight: "-0.3em",
};

// ---------- 1. "गरुड़ पुराण": Martel Heavy, स्वर्ण, mask-wipe से प्रकट, बड़ा, बायीं ओर
export const GoldTitle: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const f = useCurrentFrame();
  if (f < start || f >= end) return null;
  const p = lerp(f, [start, start + 16], [0, 1], easeOut);
  const e = enterExit(f, start, end, { inDur: 14, outDur: 9, dy: 0, dyOut: -18 });
  const rule = lerp(f, [start + 8, start + 24], [0, 1], easeOut);
  const push = interpolate(f, [start, end], [1, 1.035], clamp);
  return (
    <AbsoluteFill>
      <Scrim x={100} y={330} w={760} h={230} opacity={e.opacity * 0.9} />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 318,
          transformOrigin: "left center",
          transform: `translateY(${e.y}px) scale(${push})`,
          opacity: 1 - e.pOut,
          filter: `blur(${e.blur}px)`,
        }}
      >
        <div
          style={{
            ...martelStyle,
            ...goldText,
            fontSize: 150,
            lineHeight: 1.32,
            paddingBottom: 12,
            filter: goldBloom,
            ...(p < 0.999 ? wipeMask(p, 16) : {}),
          }}
        >
          गरुड़ पुराण
        </div>
        <div
          style={{
            height: 4,
            width: 560 * rule,
            marginTop: 2,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${C.gold}, ${mix(C.gold, C.navy, 20)})`,
            boxShadow: "0 0 14px rgba(245,166,35,0.55)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------- सामान्य कीवर्ड-पाठ: शब्द-खण्ड, रंग, आकार; प्रवेश overshoot के साथ, निकास एनिमेशन से
export type Seg = { t: string; color?: string; font?: "anek" | "poppins"; scale?: number; at?: number };

export const KeywordText: React.FC<{
  start: number;
  end: number;
  lines: Seg[][];
  size?: number;
  x?: number;
  y?: number;
  align?: "left" | "center";
}> = ({ start, end, lines, size = 118, x = 110, y = 380, align = "left" }) => {
  const f = useCurrentFrame();
  if (f < start || f >= end) return null;
  const e = enterExit(f, start, end);
  const approxW = Math.min(1000, Math.max(...lines.map((l) => l.reduce((s, g) => s + g.t.length, 0))) * size * 0.42);
  return (
    <AbsoluteFill>
      <Scrim x={x} y={y} w={approxW} h={lines.length * size * 1.25} opacity={e.opacity} />
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: align === "center" ? 1920 - 2 * x : undefined,
          textAlign: align,
          transform: `translateY(${e.y}px) scale(${e.scale})`,
          transformOrigin: align === "center" ? "center" : "left center",
          opacity: e.opacity,
          filter: `blur(${e.blur}px)`,
        }}
      >
        {lines.map((line, li) => (
          <div key={li} style={{ lineHeight: 1.22, whiteSpace: "nowrap" }}>
            {line.map((g, gi) => {
              const segStart = g.at ?? start;
              const sp = interpolate(f, [segStart, segStart + 8], [0, 1], { ...clamp, easing: easeOut });
              const pop = interpolate(f, [segStart, segStart + 9], [0.9, 1], {
                ...clamp,
                easing: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
              });
              const isNum = g.font === "poppins";
              return (
                <span
                  key={gi}
                  style={{
                    ...(isNum ? poppinsStyle : anekStyle),
                    display: "inline-block",
                    fontSize: size * (g.scale ?? 1),
                    color: g.color ?? C.cream,
                    textShadow: softShadow,
                    opacity: sp,
                    transform: `translateY(${(1 - sp) * 18}px) scale(${pop})`,
                    transformOrigin: "bottom left",
                    marginRight: size * 0.22,
                    verticalAlign: "baseline",
                    filter: g.color === C.gold ? "drop-shadow(0 0 12px rgba(245,166,35,0.35))" : undefined,
                  }}
                >
                  {g.t}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 5. पट्टी-पाठ: रजत पट्टी पर गहरा पाठ, हल्का ठहराव
export const BandText: React.FC<{ start: number; end: number; text: string; x?: number; y?: number }> = ({
  start,
  end,
  text,
  x = 110,
  y = 470,
}) => {
  const f = useCurrentFrame();
  if (f < start || f >= end) return null;
  const band = lerp(f, [start, start + 10], [0, 1], easeOut);
  const tIn = lerp(f, [start + 4, start + 13], [0, 1], (t) => easeOut(t));
  const out = lerp(f, [end - 9, end], [0, 1], easeIn);
  const sheen = interpolate(f, [start + 12, start + 30], [-30, 130], clamp);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div
        style={{
          position: "absolute",
          left: x - 26,
          top: y,
          padding: "10px 34px 4px 30px",
          transformOrigin: "left center",
          transform: `scaleX(${band}) translateY(${-out * 10}px)`,
          borderRadius: 10,
          background: `linear-gradient(180deg, ${mix(C.silver, C.cream, 55)} 0%, ${C.silver} 48%, ${mix(C.silver, C.navy, 78)} 100%)`,
          boxShadow: `0 10px 34px rgba(11,16,32,0.65), inset 0 1px 0 rgba(245,239,224,0.7), inset 0 -2px 0 rgba(11,16,32,0.25)`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            ...anekStyle,
            fontSize: 100,
            lineHeight: 1.18,
            color: C.navy,
            whiteSpace: "nowrap",
            opacity: tIn,
            transform: `translateY(${(1 - tIn) * 14}px)`,
          }}
        >
          {text}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(105deg, rgba(245,239,224,0) ${sheen - 12}%, rgba(245,239,224,0.55) ${sheen}%, rgba(245,239,224,0) ${sheen + 12}%)`,
            mixBlendMode: "screen",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3. पूरे पर्दे पर प्रश्न (भय-स्तर 3 से कम: शान्त, कोई डरावना असर नहीं)
export const QuestionFull: React.FC<{ start: number; line2At: number; end: number }> = ({ start, line2At, end }) => {
  const f = useCurrentFrame();
  if (f < start - 6 || f >= end) return null;
  const dim = interpolate(f, [start - 6, start + 6, end - 10, end], [0, 1, 1, 0], clamp);
  const l1 = enterExit(f, start, end, { inDur: 7, outDur: 9, dy: 30 });
  const l2 = enterExit(f, line2At, end, { inDur: 7, outDur: 9, dy: 30 });
  const push = interpolate(f, [start, end], [1, 1.045], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(11,16,32,0.74)", opacity: dim }} />
      <AbsoluteFill style={{ opacity: dim * 0.8 }}>
        <Particles frame={f} width={1920} height={1080} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          transform: `scale(${push})`,
        }}
      >
        <div
          style={{
            ...anekStyle,
            fontSize: 150,
            lineHeight: 1.2,
            color: C.cream,
            textShadow: softShadow,
            opacity: l1.opacity,
            transform: `translateY(${l1.y}px) scale(${l1.scale})`,
            filter: `blur(${l1.blur}px)`,
          }}
        >
          उसके भीतर
        </div>
        <div
          style={{
            ...anekStyle,
            fontSize: 150,
            lineHeight: 1.2,
            color: C.cream,
            textShadow: softShadow,
            opacity: l2.opacity,
            transform: `translateY(${l2.y}px) scale(${l2.scale})`,
            filter: `blur(${l2.blur}px)`,
            whiteSpace: "nowrap",
          }}
        >
          आखिर लिखा <span style={{ color: C.gold }}>क्या</span> है?
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 7. पूरी किताब की पट्टी: छोटा रजत हिस्सा "मृत्यु", बाकी सुनहरा (अनुपात: उत्तर/प्रेत खण्ड ≈ 10%)
export const BookBar: React.FC<{ start: number; end: number; deathShare?: number }> = ({ start, end, deathShare = 0.1 }) => {
  const f = useCurrentFrame();
  if (f < start || f >= end) return null;
  const W = 900;
  const Hh = 26;
  const track = lerp(f, [start, start + 10], [0, 1], easeOut);
  const fillG = lerp(f, [start + 4, start + 26], [0, 1], easeInOut);
  const silverIn = interpolate(f, [start + 20, start + 30], [0, 1], {
    ...clamp,
    easing: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
  });
  const sweep = interpolate(f, [start + 30, start + 52], [-15, 115], clamp);
  const out = lerp(f, [end - 9, end], [0, 1], easeIn);
  const goldW = W * (1 - deathShare);
  const silverW = W * deathShare;
  const labelIn = lerp(f, [start + 2, start + 12], [0, 1], easeOut);
  const deathLabel = lerp(f, [start + 24, start + 34], [0, 1], easeOut);
  const x = 110;
  const y = 560;
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `translateY(${-out * 12}px)` }}>
      <Scrim x={x} y={y - 120} w={W} h={260} opacity={1} />
      <div style={{ position: "absolute", left: x, top: y - 86, ...muktaStyle, fontSize: 40, color: C.cream, opacity: labelIn * 0.9, textShadow: softShadow }}>
        पूरी किताब
      </div>
      {/* पट्टी का खाँचा */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: W * track,
          height: Hh,
          borderRadius: Hh / 2,
          background: "rgba(245,239,224,0.08)",
          boxShadow: "inset 0 2px 5px rgba(0,0,0,0.6), 0 1px 0 rgba(245,239,224,0.12)",
          overflow: "hidden",
        }}
      >
        {/* सुनहरा बड़ा हिस्सा: बनावट + उभार वाली चमक */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: goldW * fillG,
            height: Hh,
            background: `repeating-linear-gradient(115deg, rgba(245,239,224,0.10) 0px, rgba(245,239,224,0.10) 3px, rgba(11,16,32,0.06) 3px, rgba(11,16,32,0.06) 7px), linear-gradient(180deg, ${mix(C.gold, C.cream, 45)} 0%, ${C.gold} 45%, ${mix(C.gold, C.navy, 70)} 100%)`,
            boxShadow: "inset 0 1px 0 rgba(245,239,224,0.75), inset 0 -2px 0 rgba(11,16,32,0.35)",
          }}
        />
        {/* रजत छोटा हिस्सा: "मृत्यु" */}
        <div
          style={{
            position: "absolute",
            left: goldW + 3,
            top: 0,
            width: Math.max(0, silverW - 3),
            height: Hh,
            transformOrigin: "left center",
            transform: `scaleX(${silverIn})`,
            background: `repeating-linear-gradient(115deg, rgba(245,239,224,0.16) 0px, rgba(245,239,224,0.16) 3px, rgba(11,16,32,0.06) 3px, rgba(11,16,32,0.06) 7px), linear-gradient(180deg, ${mix(C.silver, C.cream, 45)} 0%, ${C.silver} 45%, ${mix(C.silver, C.navy, 65)} 100%)`,
            boxShadow: "inset 0 1px 0 rgba(245,239,224,0.8), inset 0 -2px 0 rgba(11,16,32,0.3)",
          }}
        />
        {/* ऊपर से गुजरती चमक */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(100deg, rgba(245,239,224,0) ${sweep - 8}%, rgba(245,239,224,0.7) ${sweep}%, rgba(245,239,224,0) ${sweep + 8}%)`,
            mixBlendMode: "screen",
          }}
        />
      </div>
      {/* "मृत्यु" लेबल और संकेत-रेखा */}
      <div
        style={{
          position: "absolute",
          left: x + goldW + silverW / 2 - 1,
          top: y + Hh + 6,
          width: 2,
          height: 26 * deathLabel,
          background: C.silver,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x + goldW + silverW / 2,
          top: y + Hh + 30,
          transform: `translateX(-50%) translateY(${(1 - deathLabel) * 12}px)`,
          ...anekStyle,
          fontSize: 72,
          color: C.silver,
          opacity: deathLabel,
          textShadow: softShadow,
          whiteSpace: "nowrap",
        }}
      >
        मृत्यु
      </div>
    </AbsoluteFill>
  );
};

// ---------- 8. कार्ड-कतार: गहरे पत्थर पर पीतल की पट्टिका, उकेरे सुनहरे अक्षर, गुजरती रोशनी
export type Card = { lines: string[]; at: number };

const CardView: React.FC<{ card: Card; x: number; y: number; exitAt: number; moveAt?: number; fromX?: number }> = ({
  card,
  x,
  y,
  exitAt,
  moveAt,
  fromX,
}) => {
  const f = useCurrentFrame();
  const t0 = card.at;
  if (f < t0 || f >= exitAt) return null;
  const slab = interpolate(f, [t0, t0 + 10], [0, 1], { ...clamp, easing: (t) => 1 + 2.3 * Math.pow(t - 1, 3) + 1.3 * Math.pow(t - 1, 2) });
  const plate = interpolate(f, [t0 + 1, t0 + 11], [0, 1], { ...clamp, easing: easeOut }); // 40 ms बाद
  const letters = interpolate(f, [t0 + 2, t0 + 11], [0, 1], { ...clamp, easing: easeOut }); // 80 ms बाद
  const streak = interpolate(f, [t0 + 8, t0 + 24], [-40, 140], clamp);
  const out = interpolate(f, [exitAt - 8, exitAt], [0, 1], { ...clamp, easing: easeIn });
  const cx = moveAt !== undefined && fromX !== undefined ? lerp(f, [moveAt, moveAt + 9], [fromX, x], easeInOut) : x;
  const W = 440;
  const H = 250;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: y,
        width: W,
        height: H,
        opacity: Math.min(1, slab * 1.4) * (1 - out),
        transform: `translateY(${(1 - slab) * 46 - out * 16}px) scale(${0.94 + 0.06 * slab - 0.03 * out})`,
        filter: `blur(${out * 5}px)`,
      }}
    >
      {/* गहरा पत्थर */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          background: `radial-gradient(ellipse at 30% 20%, ${mix(C.silver, C.navy, 16)} 0%, ${mix(C.silver, C.navy, 8)} 45%, ${mix(C.navy, "#000", 80)} 100%)`,
          boxShadow: "0 18px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(184,196,214,0.18), inset 0 -3px 8px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.35, mixBlendMode: "overlay" }}>
          <filter id={`stone-${t0}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed={t0} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width={W} height={H} filter={`url(#stone-${t0})`} />
        </svg>
      </div>
      {/* पीतल की पट्टिका */}
      <div
        style={{
          position: "absolute",
          left: 26,
          top: 28,
          width: W - 52,
          height: H - 56,
          borderRadius: 10,
          opacity: plate,
          transform: `scale(${0.96 + 0.04 * plate})`,
          background: `repeating-linear-gradient(0deg, rgba(245,239,224,0.05) 0px, rgba(245,239,224,0.05) 1px, rgba(11,16,32,0.05) 1px, rgba(11,16,32,0.05) 3px), linear-gradient(160deg, ${mix(C.gold, C.navy, 50)} 0%, ${mix(C.gold, C.navy, 38)} 50%, ${mix(C.gold, C.navy, 28)} 100%)`,
          boxShadow: `inset 0 2px 0 rgba(245,239,224,0.35), inset 0 -3px 0 rgba(11,16,32,0.55), 0 3px 8px rgba(0,0,0,0.55)`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {card.lines.map((l, i) => (
          <div
            key={i}
            style={{
              ...anekStyle,
              fontSize: card.lines.length > 1 ? 62 : 78,
              lineHeight: 1.18,
              ...goldText,
              backgroundImage: `linear-gradient(180deg, ${C.cream} 18%, ${mix(C.gold, C.cream, 60)} 55%, ${C.gold} 100%)`,
              paddingBottom: "0.12em",
              // उकेरे अक्षर: ऊपर गहरी, नीचे हल्की धार
              filter: `drop-shadow(0 -1px 0 rgba(11,16,32,0.75)) drop-shadow(0 1px 0 rgba(245,239,224,0.30)) drop-shadow(0 0 8px rgba(245,166,35,0.35))`,
              opacity: letters,
              transform: `translateY(${(1 - letters) * 8}px)`,
              whiteSpace: "nowrap",
            }}
          >
            {l}
          </div>
        ))}
        {/* ऊपर से गुजरती रोशनी की लकीर */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(110deg, rgba(245,239,224,0) ${streak - 10}%, rgba(245,239,224,0.55) ${streak}%, rgba(245,239,224,0) ${streak + 10}%)`,
            mixBlendMode: "screen",
          }}
        />
      </div>
    </div>
  );
};

export const CardQueue: React.FC<{ cards: [Card, Card, Card]; exitAll: number }> = ({ cards, exitAll }) => {
  const f = useCurrentFrame();
  const [c1, c2, c3] = cards;
  const P1 = 100;
  const P2 = 580;
  const Y = 440;
  if (f < c1.at || f >= exitAll) return null;
  const scrim = interpolate(f, [c1.at, c1.at + 8, exitAll - 8, exitAll], [0, 1, 1, 0], clamp);
  // कतार: एक समय में अधिकतम 2 कार्ड (6 शब्द की सीमा); तीसरा आते ही पहला बाहर, दूसरा आगे
  return (
    <AbsoluteFill>
      <Scrim x={P1} y={Y} w={920} h={250} opacity={scrim} />
      <CardView card={c1} x={P1} y={Y} exitAt={c3.at - 2} />
      <CardView card={c2} x={P1} fromX={P2} moveAt={c3.at - 6} y={Y} exitAt={exitAll} />
      <CardView card={c3} x={P2} y={Y} exitAt={exitAll} />
    </AbsoluteFill>
  );
};

// ---------- 10. अन्तिम पंक्ति: पूरे पर्दे पर स्वर्ण-पाठ, 2 पंक्तियाँ, धीमा mask-wipe, पीछे लौ का धुँधला आभास
export const FinalLine: React.FC<{ start: number; line2At: number; fadeStart: number; end: number }> = ({
  start,
  line2At,
  fadeStart,
  end,
}) => {
  const f = useCurrentFrame();
  if (f < start - 10) return null;
  const dim = interpolate(f, [start - 10, start + 8], [0, 1], clamp);
  const w1 = lerp(f, [start, start + 24], [0, 1], easeInOut);
  const w2 = lerp(f, [line2At, line2At + 34], [0, 1], easeInOut);
  const toBlack = interpolate(f, [fadeStart, end], [0, 1], clamp);
  const push = interpolate(f, [start, end], [1, 1.03], clamp);
  const lineStyle: React.CSSProperties = {
    ...martelStyle,
    ...goldText,
    fontSize: 96,
    lineHeight: 1.45,
    paddingBottom: 6,
    whiteSpace: "nowrap",
    filter: goldBloom,
  };
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(11,16,32,0.8)", opacity: dim }} />
      <AbsoluteFill style={{ opacity: dim * 0.7 * (1 - toBlack) }}>
        <Particles frame={f} width={1920} height={1080} />
      </AbsoluteFill>
      <Flame frame={f} opacity={dim * 0.34} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", transform: `scale(${push})` }}>
        <div style={{ ...lineStyle, ...(w1 < 0.999 ? wipeMask(w1, 18) : {}) }}>जो जा रहा है,</div>
        <div style={{ ...lineStyle, ...(w2 < 0.999 ? wipeMask(w2, 18) : {}) }}>उसका साथ आखिर तक कैसे दिया जाए</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: toBlack }} />
    </AbsoluteFill>
  );
};

// जलती लौ का बहुत हल्का, धुँधला आभास (SVG, कोई चेहरा/आकृति नहीं)
const Flame: React.FC<{ frame: number; opacity: number }> = ({ frame, opacity }) => {
  const t = frame / 25;
  const flick = 1 + 0.03 * Math.sin(t * 6.1) + 0.015 * Math.sin(t * 11.7 + 1.3);
  const sway = 5 * Math.sin(t * 1.7);
  // पाठ के पीछे एक बड़ी, बहुत धुँधली लौ: आकार का भाव भर, कोई चमकीला केन्द्र नहीं
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id="flameCore" cx="50%" cy="70%" r="62%">
            <stop offset="0%" stopColor={C.cream} stopOpacity="0.55" />
            <stop offset="30%" stopColor={C.gold} stopOpacity="0.6" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="flameHalo" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor={C.gold} stopOpacity="0.28" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
          </radialGradient>
          <filter id="flameBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="46" />
          </filter>
        </defs>
        <ellipse cx={960} cy={560} rx={640} ry={380} fill="url(#flameHalo)" filter="url(#flameBlur)" />
        <g transform={`translate(${960 + sway} 820) scale(1.7 ${1.7 * flick}) translate(-960 -820)`} filter="url(#flameBlur)">
          <path
            d="M960 560 C 996 620, 1026 668, 1018 716 C 1011 758, 986 780, 960 784 C 934 780, 909 758, 902 716 C 894 668, 924 620, 960 560 Z"
            fill="url(#flameCore)"
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export { easeInOut };
