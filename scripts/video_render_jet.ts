import { execSync } from "child_process";
import path from "path";

const scriptPath = path.join(__dirname, "video_edit.ts");

try {
  execSync(`npx tsx "${scriptPath}" --profile=long --from-step=render --to-step=render --no-title`, {
    stdio: "inherit",
    cwd: path.resolve("."),
  });
} catch {
  process.exit(1);
}
