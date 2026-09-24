import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "./components/Background";
import { anekStyle, martelStyle, muktaStyle, poppinsStyle } from "./fonts";
import { C, goldBloom, goldFill, softShadow } from "./theme";

const label: React.CSSProperties = {
  ...muktaStyle,
  fontSize: 24,
  color: C.silver,
  letterSpacing: 0.5,
  opacity: 0.9,
  marginBottom: 18,
};

// परीक्षण-फ्रेम: तीनों पाठ पूरी सजावट में, साथ में हर फॉन्ट का नाम
export const FontTest: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background particles />
      <AbsoluteFill style={{ padding: "70px 110px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={label}>Anek Devanagari · Condensed ExtraBold 800 (दो-रंग कीवर्ड-पाठ)</div>
          <div
            style={{
              ...anekStyle,
              fontSize: 124,
              lineHeight: 1.25,
              color: C.cream,
              textShadow: softShadow,
            }}
          >
            <span style={{ color: C.gold }}>मृत</span> घोषित
          </div>
        </div>
        <div>
          <div style={label}>Martel · Heavy 900 (स्वर्ण-पाठ, bloom)</div>
          <div
            style={{
              ...martelStyle,
              fontSize: 128,
              lineHeight: 1.3,
              backgroundImage: goldFill,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: goldBloom,
              paddingBottom: 10,
            }}
          >
            गरुड़ पुराण
          </div>
        </div>
        <div>
          <div style={label}>Martel · Heavy 900 (अन्तिम पंक्ति, 2 पंक्तियाँ)</div>
          <div
            style={{
              ...martelStyle,
              fontSize: 72,
              lineHeight: 1.45,
              backgroundImage: goldFill,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: goldBloom,
            }}
          >
            जो जा रहा है,
            <br />
            उसका साथ आखिर तक कैसे दिया जाए
          </div>
        </div>
        <div style={{ display: "flex", gap: 60, alignItems: "baseline" }}>
          <div>
            <div style={label}>Poppins · Black 900 (अंक)</div>
            <div style={{ ...poppinsStyle, fontSize: 88, color: C.gold, textShadow: softShadow }}>18 · 13</div>
          </div>
          <div>
            <div style={label}>Mukta · SemiBold 600 (छोटे लेबल)</div>
            <div style={{ ...muktaStyle, fontSize: 44, color: C.cream, textShadow: softShadow }}>
              पूरी किताब · मृत्यु · आयुर्वेद
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
