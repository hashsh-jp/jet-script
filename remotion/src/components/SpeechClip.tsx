import React from "react";
import { OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { secToFrames } from "../lib/time";

interface SpeechClipProps {
  origStart: number;
  origEnd: number;
}

/**
 * 元動画の特定区間を再生するコンポーネント
 * base.mp4 は remotion/public/ から staticFile() で参照
 */
export const SpeechClip: React.FC<SpeechClipProps> = ({
  origStart,
}) => {
  const { fps } = useVideoConfig();
  const startFrom = secToFrames(origStart, fps);
  const src = staticFile("base.mp4");

  return (
    <OffthreadVideo
      src={src}
      startFrom={startFrom}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
