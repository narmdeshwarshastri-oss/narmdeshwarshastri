// पैलेट (लाल नहीं): गहरा नीला-काला, केसरिया-स्वर्ण, क्रीम, चन्द्र-रजत
export const C = {
  navy: "#0B1020",
  gold: "#F5A623",
  cream: "#F5EFE0",
  silver: "#B8C4D6",
} as const;

// इन्हीं चार रंगों से बने हल्के/गहरे रूप (color-mix), कोई नया रंग नहीं
export const mix = (a: string, b: string, pctA: number) =>
  `color-mix(in srgb, ${a} ${pctA}%, ${b})`;

export const FPS = 25;
export const W = 1920;
export const H = 1080;

// स्वर्ण-पाठ: क्रीम से केसरिया की ढलान, नीचे हल्का गहरा स्वर्ण
export const goldFill = `linear-gradient(180deg, ${C.cream} 0%, ${mix(C.gold, C.cream, 55)} 38%, ${C.gold} 62%, ${mix(C.gold, C.navy, 78)} 100%)`;

// सुनहरे पाठ पर हल्का bloom
export const goldBloom =
  "drop-shadow(0 0 10px rgba(245,166,35,0.45)) drop-shadow(0 0 28px rgba(245,166,35,0.22))";

// पाठ के पीछे नरम गहरी छाया
export const softShadow =
  "0 2px 3px rgba(11,16,32,0.85), 0 6px 18px rgba(11,16,32,0.75), 0 0 42px rgba(11,16,32,0.6)";
