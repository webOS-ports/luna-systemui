#!/bin/bash
# make-ipk.sh — turn a staged root-relative file tree into a real webOS .ipk.
#
# An .ipk is just `ar` of three members: debian-binary, control.tar.gz, data.tar.gz (see
# webos-mcp knowledge/postinst-packaging.md). palm-package only knows how to package a single
# app directory; Synergy connectors need files under /usr/palm/services, /usr/palm/public/accounts,
# /etc/palm/db, etc, so this builds the .ipk by hand instead.
#
# Usage: make-ipk.sh <package-dir> <stage-dir> <output-dir>
#   <package-dir>/control.env   required: PKG_ID, PKG_VERSION, PKG_DESC; optional PKG_DEPENDS,
#                                PKG_REPLACES, PKG_CONFLICTS, PKG_MAINTAINER (defaults below)
#   <package-dir>/postinst      optional: copied in as control.tar.gz's postinst (chmod 755)
#   <package-dir>/prerm         optional: same, as prerm
#
# Installs via Preware / WebOS Quick Install, NOT palm-install (which runs postinst/prerm as a
# non-root user, i.e. not at all) — see packaging/README.md.
set -euo pipefail

PKGDIR="$1"; STAGE="$2"; OUT="$3"

[ -f "$PKGDIR/control.env" ] || { echo "!! $PKGDIR/control.env missing" >&2; exit 1; }
[ -d "$STAGE" ] || { echo "!! stage dir $STAGE missing" >&2; exit 1; }

# Resolve to absolute paths up front — everything below cd's around (into $WORK, into $STAGE),
# so a relative $OUT/$PKGDIR would otherwise resolve against the wrong directory.
PKGDIR="$(cd "$PKGDIR" && pwd)"
STAGE="$(cd "$STAGE" && pwd)"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

# shellcheck source=/dev/null
source "$PKGDIR/control.env"
: "${PKG_ID:?PKG_ID not set in $PKGDIR/control.env}"
: "${PKG_VERSION:?PKG_VERSION not set in $PKGDIR/control.env}"
: "${PKG_DESC:?PKG_DESC not set in $PKGDIR/control.env}"
PKG_MAINTAINER="${PKG_MAINTAINER:-Herman van Hazendonk <github.com@herrie.org>}"
PKG_ARCH="${PKG_ARCH:-armv7}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ---------------------------------------------------------------- control.tar.gz
mkdir -p "$WORK/ctrl"
{
  echo "Package: $PKG_ID"
  echo "Version: $PKG_VERSION"
  echo "Architecture: $PKG_ARCH"
  echo "Maintainer: $PKG_MAINTAINER"
  [ -n "${PKG_DEPENDS:-}" ] && echo "Depends: $PKG_DEPENDS"
  [ -n "${PKG_REPLACES:-}" ] && echo "Replaces: $PKG_REPLACES"
  [ -n "${PKG_CONFLICTS:-}" ] && echo "Conflicts: $PKG_CONFLICTS"
  echo "Description: $PKG_DESC"
} > "$WORK/ctrl/control"

# POSTINST/PRERM env vars let a caller point at a shared script (e.g. one postinst reused by
# every cloud connector) instead of requiring a per-package copy; $PKGDIR/postinst|prerm wins
# if both a file and the env var somehow exist.
POSTINST_SRC="${PKGDIR}/postinst"; [ -f "$POSTINST_SRC" ] || POSTINST_SRC="${POSTINST:-}"
PRERM_SRC="${PKGDIR}/prerm"; [ -f "$PRERM_SRC" ] || PRERM_SRC="${PRERM:-}"

if [ -n "$POSTINST_SRC" ] && [ -f "$POSTINST_SRC" ]; then
  cp "$POSTINST_SRC" "$WORK/ctrl/postinst"
  chmod 755 "$WORK/ctrl/postinst"
fi
if [ -n "$PRERM_SRC" ] && [ -f "$PRERM_SRC" ]; then
  cp "$PRERM_SRC" "$WORK/ctrl/prerm"
  chmod 755 "$WORK/ctrl/prerm"
fi

( cd "$WORK/ctrl" && tar -czf "$WORK/control.tar.gz" ./control $( [ -f postinst ] && echo ./postinst ) $( [ -f prerm ] && echo ./prerm ) )

# ---------------------------------------------------------------- data.tar.gz
( cd "$STAGE" && tar -czf "$WORK/data.tar.gz" . )

# ---------------------------------------------------------------- debian-binary + ar
printf '2.0\n' > "$WORK/debian-binary"

mkdir -p "$OUT"
IPK="$OUT/${PKG_ID}_${PKG_VERSION}_all.ipk"
rm -f "$IPK"
( cd "$WORK" && ar rc "$IPK" debian-binary control.tar.gz data.tar.gz )

echo "built $IPK ($(du -h "$IPK" | cut -f1))"
