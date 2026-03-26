import React from "react";
import { Sequence, AbsoluteFill } from "remotion";
import { SpeechClip } from "./components/SpeechClip";
import { SubtitleLayer } from "./components/SubtitleLayer";
import { secToFrames } from "./lib/time";
import type { Segment } from "./lib/loadScripts";

interface ScriptCompositionProps {
  segments: Segment[];
  fps: number;
}

export const ScriptComposition: React.FC<ScriptCompositionProps> = ({ segments, fps }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {segments.map((seg) => {
        const from = secToFrames(seg.cut.start, fps);
        const duration = secToFrames(seg.cut.end - seg.cut.start, fps);
        return (
          <Sequence key={seg.id} from={from} durationInFrames={duration}>
            <SpeechClip origStart={seg.orig.start} origEnd={seg.orig.end} />
          </Sequence>
        );
      })}

      <AbsoluteFill>
        <SubtitleLayer segments={segments} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
