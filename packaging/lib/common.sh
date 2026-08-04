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
# <pkg-name> scopes the staging path per package (/media/cryptofs/luna-systemui-overwrite/<pkg-name>/...) --
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
  local ov="$STAGE/media/cryptofs/luna-systemui-overwrite/$name"
  mkdir -p "$ov"
  echo "$dst" > "$ov/dest.txt"
  : > "$ov/preserve.txt"
  local excludes=(--exclude=spec --exclude=mock --exclude=test --exclude=Gemfile
    --exclude=Gemfile.lock --exclude=Rakefile --exclude=ci_build.sh --exclude=run_tests.sh
    --exclude=all-tests.json --exclude='.rvmrc' --exclude='.project' --exclude='.git')
  local p
  for p in "$@"; do
    excludes+=(--exclude="$p")
    echo "$p" >> "$ov/preserve.txt"
  done

  # Symlinks can't be staged through the payload at all: /media/cryptofs is a FUSE mount that
  # rejects symlink() outright ("Operation not permitted", confirmed live packaging
  # messaging.library's version/1.0 -> ../submission/1.3). Record them separately and exclude
  # their paths from the tar; postinst recreates them with a real ln -s at the final (root-fs,
  # symlink-capable) destination after copying the rest of the payload there.
  : > "$ov/symlinks.txt"
  local link relpath target
  while IFS= read -r -d '' link; do
    relpath="${link#"$src"/}"
    target="$(readlink "$link")"
    printf '%s\t%s\n' "$relpath" "$target" >> "$ov/symlinks.txt"
    excludes+=(--exclude="$relpath")
  done < <(find "$src" -type l -print0)

  # --owner=0 --group=0: built on a dev machine under a regular user account, and GNU tar
  # on-device tries to restore the archive's recorded ownership on extraction as root by default --
  # confirmed live (core-apps packaging) this fails per-file on cryptofs and measurably slows
  # extraction. Store everything as root instead (postinst's --no-same-owner belt-and-suspenders
  # the same fix on the extraction side). Ship the payload as ONE tarball, not thousands of loose
  # files in data.tar.gz: confirmed live that ipkg's own offline-root extraction of ~2800 loose
  # files took ~139s, vs ~13s for a single-file data.tar.gz -- ipkg's own per-file bookkeeping (not
  # raw cryptofs FUSE throughput) is the bottleneck.
  tar -C "$src" "${excludes[@]}" --owner=0 --group=0 -czf "$ov/payload.tar.gz" .
}

# stage_files <src-dir> <dest-absolute-path> <pkg-name> <rel-file> [rel-file ...]
# Surgical alternative to stage_whole: stages only the given relative files (patched content),
# not the whole directory. Use this when most installs already have some existing (possibly
# third-party-patched) copy of <dest-absolute-path> on device -- a whole-directory replace would
# silently discard whatever else is patched there. postinst backs up (once) only the specific
# files this package is about to touch that currently exist, and overwrites/creates just those;
# prerm restores exactly that backup and deletes any file this package created that had no prior
# backup (i.e. didn't exist before this package touched it), leaving everything else in <dest>
# untouched either way.
#
# <pkg-name> scoping and the on-device tar/no-same-owner reasoning are the same as stage_whole
# above. files.txt (surgical mode) vs payload.tar.gz (whole-dir mode) is how postinst/prerm tell
# the two modes apart.
stage_files() {
  local src="$1" dst="$2" name="$3"; shift 3
  [ "$#" -gt 0 ] || { echo "!! stage_files: no files given" >&2; exit 1; }
  local ov="$STAGE/media/cryptofs/luna-systemui-overwrite/$name"
  mkdir -p "$ov"
  echo "$dst" > "$ov/dest.txt"
  : > "$ov/files.txt"
  local rel
  for rel in "$@"; do
    [ -f "$src/$rel" ] || { echo "!! stage_files: $src/$rel missing" >&2; exit 1; }
    echo "$rel" >> "$ov/files.txt"
  done
  tar -C "$src" --owner=0 --group=0 -czf "$ov/files.tar.gz" -T "$ov/files.txt"
}
