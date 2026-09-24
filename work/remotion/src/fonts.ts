import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// चारों फॉन्ट Google Fonts के आधिकारिक GitHub भण्डार (github.com/google/fonts, ofl/) से
export const FONT = {
  anek: "Anek Devanagari", // AnekDevanagari[wdth,wght].ttf: Condensed (wdth 75), ExtraBold 800
  poppins: "Poppins", // Poppins-Black.ttf: 900
  martel: "Martel", // Martel-Heavy.ttf: 900
  mukta: "Mukta", // Mukta-SemiBold.ttf: 600
} as const;

export const FONT_FILES = [
  "fonts/AnekDevanagari-VF.ttf",
  "fonts/Poppins-Black.ttf",
  "fonts/Martel-Heavy.ttf",
  "fonts/Mukta-SemiBold.ttf",
];

// Anek Devanagari: Condensed ExtraBold
export const anekStyle: React.CSSProperties = {
  fontFamily: `'${FONT.anek}'`,
  fontWeight: 800,
  fontStretch: "75%",
  fontVariationSettings: "'wdth' 75, 'wght' 800",
};
export const martelStyle: React.CSSProperties = {
  fontFamily: `'${FONT.martel}'`,
  fontWeight: 900,
};
export const poppinsStyle: React.CSSProperties = {
  fontFamily: `'${FONT.poppins}'`,
  fontWeight: 900,
};
export const muktaStyle: React.CSSProperties = {
  fontFamily: `'${FONT.mukta}'`,
  fontWeight: 600,
};

let started = false;

// रेंडर से पहले font load की प्रतीक्षा (delayRender/continueRender)
export const ensureFonts = () => {
  if (started) return;
  started = true;
  const handle = delayRender("फॉन्ट लोड हो रहे हैं", { timeoutInMilliseconds: 60000 });
  const faces = [
    new FontFace(FONT.anek, `url('${staticFile(FONT_FILES[0])}') format('truetype')`, {
      weight: "100 800",
      stretch: "75% 125%",
    }),
    new FontFace(FONT.poppins, `url('${staticFile(FONT_FILES[1])}') format('truetype')`, { weight: "900" }),
    new FontFace(FONT.martel, `url('${staticFile(FONT_FILES[2])}') format('truetype')`, { weight: "900" }),
    new FontFace(FONT.mukta, `url('${staticFile(FONT_FILES[3])}') format('truetype')`, { weight: "600" }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
      return document.fonts.ready;
    })
    .then(() => {
      const ok = [
        document.fonts.check(`800 40px '${FONT.anek}'`, "गरुड़"),
        document.fonts.check(`900 40px '${FONT.poppins}'`, "18"),
        document.fonts.check(`900 40px '${FONT.martel}'`, "गरुड़"),
        document.fonts.check(`600 40px '${FONT.mukta}'`, "मृत्यु"),
      ];
      if (ok.includes(false)) {
        throw new Error("कोई फॉन्ट लोड नहीं हुआ: " + JSON.stringify(ok));
      }
      continueRender(handle);
    })
    .catch((err) => cancelRender(err));
};
