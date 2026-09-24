import { Easing, interpolate } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// हल्का overshoot (लगभग 6%)
export const easeOutBack = Easing.bezier(0.34, 1.32, 0.64, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.5, 0, 0.75, 0);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const lerp = (frame: number, input: number[], output: number[], easing = easeOut) =>
  interpolate(frame, input, output, { ...clamp, easing });

/**
 * प्रवेश (overshoot के साथ) और निकास (ease-in) का साझा चाल-मान।
 * start: पहला फ्रेम; end: निकास पूरा होने का फ्रेम।
 */
export const enterExit = (
  frame: number,
  start: number,
  end: number,
  { inDur = 9, outDur = 8, dy = 26, dyOut = -14, blurOut = 6 } = {},
) => {
  const pIn = interpolate(frame, [start, start + inDur], [0, 1], { ...clamp, easing: easeOutBack });
  const oIn = interpolate(frame, [start, start + Math.max(4, inDur * 0.6)], [0, 1], clamp);
  const pOut = interpolate(frame, [end - outDur, end], [0, 1], { ...clamp, easing: easeIn });
  return {
    visible: frame >= start && frame < end,
    opacity: oIn * (1 - pOut),
    y: (1 - pIn) * dy + pOut * dyOut,
    scale: 0.965 + 0.035 * pIn,
    blur: pOut * blurOut,
    pIn,
    pOut,
  };
};

// नरम किनारे वाला mask-wipe (बायें से दायें)
export const wipeMask = (p: number, soft = 14): React.CSSProperties => {
  const edge = -soft + p * (100 + soft);
  const m = `linear-gradient(90deg, #000 0%, #000 ${edge}%, transparent ${edge + soft}%)`;
  return { WebkitMaskImage: m, maskImage: m };
};
