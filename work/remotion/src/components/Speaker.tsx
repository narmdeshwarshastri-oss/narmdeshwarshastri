import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { lerp, easeInOut } from "../anim";

// कटा हुआ वक्ता: 4K के x 850-2850 हिस्से का 0.675 गुना (1350x1458), alpha सहित ProRes 4444
export const LAYER_W = 1350;
export const LAYER_H = 1458;
export const FACE_IN_LAYER = { x: 661.5, y: 337.5 }; // 4K (1830, 500)
export const FACE_ON_SCREEN = { x: 1392, y: 300 };   // वक्ता दाहिनी ओर

export type ZoomKey = { f: number; z: number; dur?: number };

// ज़ूम-योजना से किसी फ्रेम का आकार (1.00 / 1.15 / 1.35)
export const zoomAt = (frame: number, keys: ZoomKey[]) => {
  let z = keys[0].z;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (frame < k.f) break;
    const d = k.dur ?? 0;
    z = d > 0 ? lerp(frame, [k.f, k.f + d], [z, k.z], easeInOut) : k.z;
  }
  return z;
};

export const Speaker: React.FC<{ zoom: number; opacity: number }> = ({ zoom, opacity }) => {
  const frame = useCurrentFrame();
  const k = (0.5 * zoom) / 0.675;
  const left = FACE_ON_SCREEN.x - FACE_IN_LAYER.x * k;
  const top = FACE_ON_SCREEN.y - FACE_IN_LAYER.y * k;
  void frame;
  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: LAYER_W * k,
          height: LAYER_H * k,
        }}
      >
        <OffthreadVideo
          src={staticFile("media/speaker_4444.mov")}
          transparent
          muted
          // कुर्ते के सबसे उजले हिस्से clip न हों (लगभग 3.5% कम)
          style={{ width: "100%", height: "100%", filter: "brightness(0.965)" }}
        />
      </div>
    </AbsoluteFill>
  );
};
