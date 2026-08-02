#!/bin/bash
# common.sh — shared staging helper for packaging/*/stage.sh scripts in this repo.
set -euo pipefail

# stage_whole <src-dir> <dest-absolute-path> <pkg-name> [preserve-subpath ...]
# Stages an entire app/framework directory as the package payload (excluding dev-only cruft:
# tests, CI/build scripts, Ruby bundler files -- not part of the running app/framework), plus a
# dest.txt naming the real absolute path postinst/prerm replace. One ipk == one whole-directory
# replacement (not a surgical per-file patch): the repo is the single source of truth for this
# component, so shipping everything (not just recently-touched files) keeps a fresh install and an
# upgrade identical instead of depending on accumulated history.
#
# <pkg-name> scopes the staging path per package (/opt/luna-systemui-overwrite/<pkg-name>/...) --
# without this, every package's payload/appinfo.json, payload/depends.js, dest.txt etc. would all
# land at the exact same shared path, and ipkg treats two packages both shipping the same tracked
# filename as a hard conflict (confirmed live installing accounts then phone).
#
# [preserve-subpath ...]: relative subpaths (e.g. "filecache_types") that hold LIVE RUNTIME DATA
# collocated in the same directory as the code (e.g. contacts.linker's on-device
# filecache_types/{contactphoto,contactvcard} cache) rather than tracked source -- postinst/prerm
# must carry these across the rm -rf/replace instead of deleting them. Written to preserve.txt so
# postinst/prerm (which only see the staged payload, not this script) know what to protect.
stage_whole() {
  local src="$1" dst="$2" name="$3"; shift 3 || true
  [ -d "$src" ] || { echo "!! stage_whole: $src missing" >&2; exit 1; }
  local ov="$STAGE/opt/luna-systemui-overwrite/$name"
  mkdir -p "$ov"
  echo "$dst" > "$ov/dest.txt"
  mkdir -p "$ov/payload"
  : > "$ov/preserve.txt"
  local excludes=(--exclude=spec --exclude=mock --exclude=test --exclude=Gemfile
    --exclude=Gemfile.lock --exclude=Rakefile --exclude=ci_build.sh --exclude=run_tests.sh
    --exclude=all-tests.json --exclude='.rvmrc' --exclude='.project' --exclude='.git')
  local p
  for p in "$@"; do
    excludes+=(--exclude="$p")
    echo "$p" >> "$ov/preserve.txt"
  done
  tar -C "$src" "${excludes[@]}" -cf - . \
    | tar -C "$ov/payload" -xf -
}
