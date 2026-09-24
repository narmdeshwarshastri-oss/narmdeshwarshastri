import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

/**
 * अस्थायी पृष्ठभूमि (assets/background.png न होने पर):
 * गहरा नीला-काला ढलान, दाहिनी ओर एक दीपक जैसी गर्म सुनहरी रोशनी, बायाँ हिस्सा गहरा,
 * तैरते सुनहरे कण, कोनों पर बहुत हल्का vignette। पूरी अवधि में 2.5% की धीमी चाल।
 */
export const Background: React.FC<{
  zoom?: number; // वक्ता के ज़ूम का 65% (parallax)
  anchorX?: number;
  anchorY?: number;
  glowBoost?: number; // राहत वाले क्षण में रोशनी का हल्का उभार (0-1)
  particles?: boolean;
}> = ({ zoom = 1, anchorX = 1392, anchorY = 300, glowBoost = 0, particles = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  // धीमी चाल: 2.5% बहाव (दायें से बायें) और 2% धीमा push-in
  const driftX = -0.025 * width * t;
  const drift = 1 + 0.02 * t;
  // दीपक का बहुत धीमा "साँस" जैसा उतार-चढ़ाव (±3%), कोई झिलमिलाहट नहीं
  const breathe = 1 + 0.03 * Math.sin((frame / 25) * 2 * Math.PI * 0.18);
  const glowA = (0.26 + 0.07 * glowBoost) * breathe;

  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformOrigin: `${anchorX}px ${anchorY}px`,
          transform: `translateX(${driftX}px) scale(${zoom * drift})`,
        }}
      >
        {/* आधार: बायाँ गहरा, दायाँ थोड़ा उठा हुआ */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(100deg, color-mix(in srgb, ${C.navy} 70%, #000) 0%, ${C.navy} 45%, color-mix(in srgb, ${C.navy} 88%, ${C.gold}) 100%)`,
          }}
        />
        {/* दीपक जैसी गर्म रोशनी, वक्ता के पीछे दाहिनी ओर */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 34% 46% at 76% 40%, rgba(245,166,35,${glowA}) 0%, rgba(245,166,35,${glowA * 0.45}) 38%, rgba(245,166,35,0) 72%)`,
          }}
        />
        {/* रोशनी का क्रीम केन्द्र (बहुत धीमा) */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 80% 36%, rgba(245,239,224,${0.07 * breathe}) 0%, rgba(245,239,224,0) 18%)`,
          }}
        />
        {/* ऊपर-नीचे हल्की छाया ताकि कक्ष का भाव बने */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.30) 100%)",
          }}
        />
        {particles ? <Particles frame={frame} width={width} height={height} /> : null}
      </AbsoluteFill>
      {/* बहुत हल्का vignette, केवल कोनों पर */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 78% at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.30) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const N = 70;

export const Particles: React.FC<{ frame: number; width: number; height: number }> = ({ frame, width, height }) => {
  const items = [];
  for (let i = 0; i < N; i++) {
    const r1 = random(`p-x-${i}`);
    const r2 = random(`p-y-${i}`);
    const r3 = random(`p-s-${i}`);
    const r4 = random(`p-v-${i}`);
    const r5 = random(`p-ph-${i}`);
    // दाहिनी ओर (रोशनी के पास) घने, बायीं ओर विरल
    const bx = Math.pow(r1, 0.55) * width * 1.05;
    const speed = 6 + r4 * 16; // px प्रति सेकंड, ऊपर की ओर
    const y = ((r2 * (height + 200) - (frame / 25) * speed) % (height + 200) + (height + 200)) % (height + 200) - 100;
    const sway = Math.sin(frame / 25 * (0.25 + r5 * 0.4) + r5 * 6.28) * (8 + r3 * 14);
    const size = 1.2 + Math.pow(r3, 2.2) * 6.5;
    const near = size > 4.5; // बड़े कण धुँधले (bokeh)
    const tw = 0.55 + 0.45 * Math.sin(frame / 25 * (0.6 + r4) + r1 * 10);
    const baseOpacity = (0.12 + 0.4 * r5) * (0.35 + 0.65 * (bx / width));
    items.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: bx + sway,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.cream} 0%, ${C.gold} 45%, rgba(245,166,35,0) 100%)`,
          opacity: baseOpacity * tw,
          filter: near ? `blur(${1.2 + (size - 4.5) * 0.6}px)` : undefined,
        }}
      />,
    );
  }
  return <AbsoluteFill>{items}</AbsoluteFill>;
};
