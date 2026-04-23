# Repository Guidelines

## Project Structure & Module Organization
`scripts/` contains the TypeScript CLI pipeline: transcription, subtitle cleanup, base-video merging, and final render orchestration. `remotion/src/` contains the Remotion compositions, React components, and small helpers used to generate video frames. `assets/` stores bundled media such as `bgm.mp3`. Root config is in `package.json` and `tsconfig.json`; `remotion/package.json` is only for local composition preview with Remotion Studio.

## Build, Test, and Development Commands
Install dependencies with `npm install` in the repo root, then use:

- `npm run all` to run the default long-video pipeline end to end.
- `VIDEO_TITLE="My Title" npm run all:title` to also create `titled.mp4`.
- `npm run transcribe` to stop after transcript generation.
- `npm run render` to re-render from saved timeline JSON in the working directory.
- `npm run base-video` to combine `base1.mp4`, `base2.mp4`, etc. into `base.mp4`.
- `npm run typecheck` for the main automated validation step.
- `cd remotion && npm run studio` to inspect compositions visually.

## Coding Style & Naming Conventions
Use TypeScript with strict typing, ES module imports, and 2-space indentation. Keep utility functions in `camelCase`, React components and composition props in `PascalCase`, and script filenames in the existing kebab or snake style such as `base-video.ts` and `video_edit.ts`. Match current patterns: small pure helpers near usage, explicit return types on exported functions, and concise console logging for pipeline steps.

## Testing Guidelines
There is no dedicated test suite yet; treat `npm run typecheck` as the minimum gate. For changes under `scripts/`, verify the affected command against sample media in `~/Downloads` and confirm expected outputs such as `script.mp4`, `titled.mp4`, or `.tmp/jet-script-work/scripts.json`. For changes in `remotion/src/`, open Studio or run a render path that exercises the edited composition.

## Commit & Pull Request Guidelines
Recent history uses very short subjects like `a` and `ok`; keep commits short and imperative, but prefer clearer summaries that describe the pipeline change. PRs should state the user-visible effect, list commands run for validation, mention any required environment variables or `ffmpeg` assumptions, and include screenshots or output file notes when changing subtitles, timing, or composition layout.

## Configuration & Environment Notes
This project assumes macOS, Node.js 18+, `ffmpeg`, `ffprobe`, and `OPENAI_API_KEY`. Keep secrets in local `.env` files only, and do not commit generated media or API credentials.
