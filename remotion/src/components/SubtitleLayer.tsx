import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Segment } from "../lib/loadScripts";

interface SubtitleLayerProps {
  segments: Segment[];
}

export const SubtitleLayer: React.FC<SubtitleLayerProps> = ({ segments }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentSec >= seg.cut.start && currentSec < seg.cut.end
  );

  if (!activeSegment) return null;

  const lines = activeSegment.text.split("\n");

  return (
    <div
      style={{
        position: "absolute",
        bottom: 160,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: "92%",
        }}
      >
        {lines.map((line: string, i: number) => (
          <div
            key={i}
            style={{
              color: "#ffffff",
              fontSize: 44,
              fontWeight: 800,
              fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
              textAlign: "center",
              lineHeight: 1.4,
              WebkitTextStroke: "6px #000000",
              textShadow:
                "-4px 0 0 #000, 4px 0 0 #000, 0 -4px 0 #000, 0 4px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000",
              paintOrder: "stroke fill",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
