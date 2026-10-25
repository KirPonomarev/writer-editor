#!/usr/bin/env bash
set -euo pipefail

src_path="${1:-src/renderer/assets/logo.png}"
out_dir="${2:-build}"

if [[ ! -f "$src_path" ]]; then
  echo "Logo not found: $src_path" >&2
  echo "Place the logo PNG at src/renderer/assets/logo.png or pass a path as the first arg." >&2
  exit 1
fi

node - "$src_path" <<'NODE'
const fs = require('node:fs');
const source = fs.readFileSync(process.argv[2]);
if (source.length < 24 || source.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || source.readUInt32BE(16) !== 1024 || source.readUInt32BE(20) !== 1024) {
  throw new Error('Canonical app icon source must be a prepared 1024x1024 PNG.');
}
NODE

for tool in sips iconutil; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool not found (macOS required)." >&2
    exit 1
  fi
done

# Preserve the approved source pixels, alpha and colors exactly.
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT
cp -f "$src_path" "$temp_dir/icon.png"
iconset_path="$temp_dir/icon.iconset"
mkdir "$iconset_path"
for size in 16 32 128 256 512; do
  sips --resampleHeightWidth "$size" "$size" "$temp_dir/icon.png" \
    --out "$iconset_path/icon_${size}x${size}.png" >/dev/null
  retina_size=$((size * 2))
  if [[ "$retina_size" -eq 1024 ]]; then
    cp -f "$temp_dir/icon.png" "$iconset_path/icon_${size}x${size}@2x.png"
  else
    sips --resampleHeightWidth "$retina_size" "$retina_size" "$temp_dir/icon.png" \
      --out "$iconset_path/icon_${size}x${size}@2x.png" >/dev/null
  fi
done
iconutil --convert icns --output "$temp_dir/icon.icns" "$iconset_path"
if [[ ! -f "$temp_dir/icon.icns" ]]; then
  echo "Failed to render icon.icns" >&2
  exit 1
fi
mkdir -p "$out_dir"
cp -f "$temp_dir/icon.png" "$out_dir/icon.png"
cp -f "$temp_dir/icon.icns" "$out_dir/icon.icns"

echo "Wrote $out_dir/icon.png"
echo "Wrote $out_dir/icon.icns"
