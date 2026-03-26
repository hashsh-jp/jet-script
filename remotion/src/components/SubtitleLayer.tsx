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
        bottom: 40,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: "88%",
        }}
      >
        {lines.map((line: string, i: number) => (
          <div
            key={i}
            style={{
              color: "#ffffff",
              fontSize: 32,
              fontWeight: 800,
              fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
              textAlign: "center",
              lineHeight: 1.4,
              WebkitTextStroke: "5px #000000",
              textShadow:
                "-3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
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
