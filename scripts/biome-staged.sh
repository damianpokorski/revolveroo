#!/usr/bin/env bash
# Runs `biome check --write --staged`, but treats "no files were processed"
# as a no-op success instead of a failure. Biome's --staged mode passes it
# the full staged file list and errors out if every one of those paths is a
# type it doesn't handle (e.g. Markdown, which Biome doesn't support at all) -
# this happens for commits that only touch files like README.md. A real lint
# failure always processes at least one file, so this check is precise.
set -uo pipefail

output="$(bunx biome check --write --staged 2>&1)"
status=$?

if [ $status -ne 0 ] && echo "$output" | grep -q "No files were processed in the specified paths."; then
  echo "$output"
  echo "biome-staged: no staged files are processable by Biome (e.g. Markdown-only commit) - skipping."
  exit 0
fi

echo "$output"
exit $status
