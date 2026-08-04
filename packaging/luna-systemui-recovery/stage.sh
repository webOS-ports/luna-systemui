#!/bin/bash
# stage.sh — package a pristine, stock luna-systemui as a whole-directory-replace rescue ipk.
# Source is a real stock device rootfs snapshot, NOT this repo (whose whole point is to carry our
# own patch on top of stock) - installing this package resets /usr/lib/luna/system/luna-systemui
# back to exactly what a virgin device has, undoing any patches (ours or third-party) accumulated
# there. See packaging/luna-systemui/stage.sh for the actual (surgical, single-file) patch package.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

STOCK="/home/herrie/webos/touchpad-kernel/doctor305/StockRootfs/usr/lib/luna/system/luna-systemui"
[ -d "$STOCK" ] || { echo "!! stock snapshot missing: $STOCK" >&2; exit 1; }

stage_whole "$STOCK" /usr/lib/luna/system/luna-systemui luna-systemui-recovery

echo "luna-systemui-recovery stage complete: $STAGE"
