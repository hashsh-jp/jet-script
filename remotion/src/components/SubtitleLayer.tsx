import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Segment } from "../lib/loadScripts";



interface SubtitleLayerProps {
  segments: Segment[];
}

/**
 * 字幕を2行折り返し、白文字＋黒フチ、下中央配置で表示
 */
export const SubtitleLayer: React.FC<SubtitleLayerProps> = ({ segments }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  // 現在の時刻に対応するセグメントを特定
  const activeSegment = segments.find(
    (seg) => currentSec >= seg.cut.start && currentSec < seg.cut.end
  );

  if (!activeSegment) return null;

  // 改行コードで分割
  const lines = activeSegment.text.split("\n");

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          borderRadius: 8,
          padding: "8px 20px",
          maxWidth: "85%",
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              color: "#ffffff",
              fontSize: 36,
              fontWeight: 700,
              fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
              textAlign: "center",
              lineHeight: 1.4,
              textShadow:
                "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};


