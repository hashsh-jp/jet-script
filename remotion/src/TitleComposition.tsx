import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

interface TitleCompositionProps {
  title: string;
}

export const TitleComposition: React.FC<TitleCompositionProps> = ({ title }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile("script.mp4")}
        style={{ width: "100%", height: "100%" }}
      />
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            padding: "18px",
            color: "#fff",
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.25,
            maxWidth: "90%",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            textShadow: "3px 3px 3px rgba(0, 0, 0, 0.85)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "\"Hiragino Sans\", \"Yu Gothic\", \"Noto Sans CJK JP\", sans-serif",
          }}
        >
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
