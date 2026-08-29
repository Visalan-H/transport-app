#!/usr/bin/env bash
#
# Pulls main and any new images, then restarts only what actually changed.
# Meant to be run from cron on the production VM; safe to run when nothing has
# changed, in which case it does nothing and prints nothing.
#
#   sudo cp scripts/auto-deploy.sh /usr/local/bin/polaris-deploy
#   sudo chmod +x /usr/local/bin/polaris-deploy
#
# See README for the crontab line.

set -euo pipefail

REPO="${POLARIS_REPO:-/home/azureuser/polaris}"
cd "$REPO"

# Cron can overlap if a deploy runs long. Two concurrent `compose up` runs on
# the same project is a good way to end up with containers in a weird state.
exec 9>/tmp/polaris-deploy.lock
flock -n 9 || exit 0

log() { echo "[$(date --iso-8601=seconds)] $*"; }

before_head=$(git rev-parse HEAD)

# --ff-only so a local edit on the VM stops the deploy loudly instead of being
# silently merged. This has bitten before: a hand-edited docker-compose.yml.
if ! git pull --ff-only --quiet; then
    log "git pull failed -- the working tree has local changes. Not deploying."
    exit 1
fi

after_head=$(git rev-parse HEAD)

# Compose compares image digests, so this is a cheap registry HEAD when
# nothing new has been published.
pulled=$(docker compose pull --quiet 2>&1) || { log "image pull failed: $pulled"; exit 1; }

# `up -d` only recreates containers whose image or config actually changed, so
# an unchanged service keeps running untouched and there is no needless restart.
changed_output=$(docker compose up -d 2>&1)

if [ "$before_head" != "$after_head" ] || echo "$changed_output" | grep -qiE 'recreat|start|creat'; then
    log "deployed ${before_head:0:7} -> ${after_head:0:7}"
    echo "$changed_output" | sed 's/^/    /'
    # Superseded images pile up and this box is small. Only untagged layers
    # nothing references are removed.
    docker image prune -f >/dev/null
fi
