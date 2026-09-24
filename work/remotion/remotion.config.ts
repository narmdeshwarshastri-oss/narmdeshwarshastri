/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG फ्रेम: पाठ के किनारे और सुनहरी चमक में JPEG के धब्बे न आएँ
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// कंटेनर में पहले से लगा Chromium headless-shell (Remotion का अलग Chrome डाउनलोड नहीं)
Config.setBrowserExecutable(
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
);
