#!/bin/bash
# stage.sh — package the WHOLE luna-systemui component (stock ipkg name "luna-systemui", installed
# at /usr/lib/luna/system/luna-systemui) as its own ipk. This repo root IS that component (its
# top-level layout mirrors the on-device directory exactly: app/, appinfo.json, data/, depends.js,
# framework_config.json, ...); postinst replaces the whole directory wholesale.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO" /usr/lib/luna/system/luna-systemui luna-systemui packaging

echo "luna-systemui stage complete: $STAGE"
