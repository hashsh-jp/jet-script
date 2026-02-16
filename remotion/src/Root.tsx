import React from "react";
import { Composition } from "remotion";
import { JetComposition } from "./JetComposition";
import { ScriptComposition } from "./ScriptComposition";
import type { Segment } from "./lib/loadScripts";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const defaultProps = {
  segments: [] as Segment[],
  fps: FPS,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="JetComposition"
        component={JetComposition as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
      />
      <Composition
        id="ScriptComposition"
        component={ScriptComposition as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
      />
    </>
  );
};
