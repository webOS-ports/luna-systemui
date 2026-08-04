#!/bin/bash
# build-all.sh — stage + package every component in packaging/ into packaging/out/*.ipk.
#
# Usage: packaging/build-all.sh [name...]
#   no args        build everything
#   name...        build only the named package(s)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
mkdir -p "$OUT"

NAMES=(luna-systemui luna-systemui-recovery)

want() {  # $1 = name; true if no filter args were given, or $1 is among them
  [ "${#FILTER[@]}" -eq 0 ] && return 0
  local n
  for n in "${FILTER[@]}"; do [ "$n" = "$1" ] && return 0; done
  return 1
}

FILTER=("$@")

for name in "${NAMES[@]}"; do
  if want "$name"; then
    echo "############################################################"
    echo "# $name"
    echo "############################################################"
    stage="$(mktemp -d)"
    bash "$HERE/$name/stage.sh" "$stage"
    POSTINST="$HERE/lib/postinst" PRERM="$HERE/lib/prerm" bash "$HERE/lib/make-ipk.sh" "$HERE/$name" "$stage" "$OUT"
    rm -rf "$stage"
  fi
done

echo "############################################################"
echo "built $(ls "$OUT"/*.ipk 2>/dev/null | wc -l) package(s) in $OUT"
