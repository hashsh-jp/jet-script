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
            top: 16,
            left: 16,
            padding: "12px 18px 12px 16px",
            color: "#fff",
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.3,
            maxWidth: "88%",
            background: "linear-gradient(135deg, rgba(0,20,40,0.85) 0%, rgba(0,10,25,0.8) 100%)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(0,180,255,0.15)",
            borderLeft: "3px solid #00d4ff",
            borderBottom: "1px solid rgba(0,180,255,0.25)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            letterSpacing: "0.02em",
            fontFamily: "\"Hiragino Sans\", \"Yu Gothic\", \"Noto Sans CJK JP\", sans-serif",
          }}
        >
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
