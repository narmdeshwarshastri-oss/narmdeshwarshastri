import React from "react";
import { Composition, Still } from "remotion";
import { Background } from "./components/Background";
import { ensureFonts } from "./fonts";
import { FontTest } from "./FontTest";
import { Hook } from "./Hook";
import { FPS, H, W } from "./theme";
import timing from "./data/timing.json";

ensureFonts();

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Hook"
        component={Hook}
        durationInFrames={timing.edit_duration_frames}
        fps={FPS}
        width={W}
        height={H}
      />
      <Still id="FontTest" component={FontTest} width={W} height={H} />
      {/* light wrap के लिए पृष्ठभूमि का स्थिर चित्र (कणों के बिना) */}
      <Still id="BgPlate" component={() => <Background particles={false} />} width={W} height={H} />
    </>
  );
};
