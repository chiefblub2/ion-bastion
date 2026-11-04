#!/bin/sh
# Run-mode fingerprint: seeded bot runs with no relic forced and with each protocol relic.
# Usage: sh scripts/run-golden.sh > before.txt; (refactor); sh scripts/run-golden.sh | diff before.txt -
set -e
npx vite-node scripts/run-balance.ts -- --seeds 6 --length short
for r in fracture killbox unstable singularity armorbreaker replicator skyhunter titancore scanner; do
  echo "== relic $r"; npx vite-node scripts/run-balance.ts -- --seeds 4 --length short --relic $r
done
