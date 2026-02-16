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

/**
 * 字幕付きコンポジション: JetComposition と同じ映像 + SubtitleLayer
 */
export const ScriptComposition: React.FC<ScriptCompositionProps> = ({
  segments,
  fps,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 映像レイヤー: JetComposition と同じ構造 */}
      {segments.map((seg) => {
        const from = secToFrames(seg.cut.start, fps);
        const duration = secToFrames(seg.cut.end - seg.cut.start, fps);
        return (
          <Sequence key={seg.id} from={from} durationInFrames={duration}>
            <SpeechClip origStart={seg.orig.start} origEnd={seg.orig.end} />
          </Sequence>
        );
      })}

      {/* 字幕レイヤー: 全体に重ねる */}
      <AbsoluteFill>
        <SubtitleLayer segments={segments} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
