import React from "react";
import { Composition } from "remotion";
import { VideoComposition } from "./video-composition";
import type { Segment } from "./lib/loadScripts";

const FPS = 30;
const WIDTH = 1280;
const HEIGHT = 720;

const defaultProps = {
  segments: [] as Segment[],
  fps: FPS,
  title: "",
  withSubtitle: false,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ScriptComposition"
        component={VideoComposition as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...defaultProps, withSubtitle: true }}
      />
    </>
  );
};
