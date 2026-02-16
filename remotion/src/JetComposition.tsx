import React from "react";
import { Sequence, AbsoluteFill } from "remotion";
import { SpeechClip } from "./components/SpeechClip";
import { secToFrames } from "./lib/time";
import type { Segment } from "./lib/loadScripts";

interface JetCompositionProps {
  segments: Segment[];
  fps: number;
}

/**
 * 無音全カット: セグメントの orig 区間だけを cut タイムラインに並べて連結
 */
export const JetComposition: React.FC<JetCompositionProps> = ({
  segments,
  fps,
}) => {
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
    </AbsoluteFill>
  );
};
