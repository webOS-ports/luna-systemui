#!/bin/bash
# stage.sh — package just OUR patched file(s) in luna-systemui (stock ipkg name "luna-systemui",
# installed at /usr/lib/luna/system/luna-systemui), not the whole component. Most devices already
# have some existing (possibly third-party-patched) copy of luna-systemui on disk, so a
# whole-directory replace would silently discard whatever else is patched there. Ship a surgical
# per-file patch instead - see stage_files in common.sh and packaging/lib/postinst/prerm's
# "surgical mode" for how these get applied/restored on device without touching anything else
# already under that directory.
#
# Just the FilePicker newest-first album sort itself (see control.env's PKG_DESC) - the
# resources/*/FilePicker/* locale entries that also differ from upstream/webOS-ports/master are
# NOT this patch's doing, so they aren't shipped here.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_files "$REPO" /usr/lib/luna/system/luna-systemui luna-systemui \
  app/FilePicker/AlbumGridView.js

echo "luna-systemui stage complete: $STAGE"
