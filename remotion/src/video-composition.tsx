import React from "react";
import { Sequence, AbsoluteFill } from "remotion";
import { SpeechClip } from "./components/SpeechClip";
import { SubtitleLayer } from "./components/SubtitleLayer";
import { secToFrames } from "./lib/time";
import type { Segment } from "./lib/loadScripts";

interface VideoCompositionProps {
  segments: Segment[];
  fps: number;
  withSubtitle?: boolean;
}

/**
 * 統合コンポジション: 映像レイヤー + オプションで字幕レイヤー
 */
export const VideoComposition: React.FC<VideoCompositionProps> = ({
  segments,
  fps,
  withSubtitle = false,
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

      {withSubtitle && (
        <AbsoluteFill>
          <SubtitleLayer segments={segments} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
