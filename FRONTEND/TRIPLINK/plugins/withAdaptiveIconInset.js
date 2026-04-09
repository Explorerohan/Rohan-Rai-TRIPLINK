/**
 * Android adaptive icons scale the foreground to fill a 108dp layer, then the launcher mask
 * crops the outer rim — logos that touch the edges look "zoomed". This adds ~20dp inset
 * (≈18% per side) so the artwork sits in the safe zone. Re-applied on each `expo prebuild`.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const INSET_XML = `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@mipmap/ic_launcher_foreground"
    android:insetLeft="20dp"
    android:insetTop="20dp"
    android:insetRight="20dp"
    android:insetBottom="20dp" />
`;

const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground_inset"/>
</adaptive-icon>
`;

module.exports = function withAdaptiveIconInset(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.platformProjectRoot;
      const drawableDir = path.join(root, "app/src/main/res/drawable");
      const mipmapDir = path.join(root, "app/src/main/res/mipmap-anydpi-v26");
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.mkdirSync(mipmapDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, "ic_launcher_foreground_inset.xml"), INSET_XML);
      fs.writeFileSync(path.join(mipmapDir, "ic_launcher.xml"), ADAPTIVE_ICON_XML);
      fs.writeFileSync(path.join(mipmapDir, "ic_launcher_round.xml"), ADAPTIVE_ICON_XML);
      return config;
    },
  ]);
}
