#!/usr/bin/env bash
# Production deploys run via .github/workflows/deploy.yml on every push to master.
# This script exists only so `make deploy` doesn't fail silently — and to remind you
# of the manual rollback path.
set -euo pipefail

cat <<'EOF'
Production deploys are automated.

  • Push to master → GitHub Actions builds api/web/migrate images,
    pushes to ghcr.io/emilijan-koteski/beljot-*, then SSHes into the VPS,
    runs migrations, and rolls the stack with `docker compose up -d`.

  • Manual rollback (on the VPS, as user `deploy`):
        cd /opt/beljot
        sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<old-sha>/' .env
        docker compose -f docker-compose.prod.yml pull
        docker compose -f docker-compose.prod.yml up -d

  • Force a redeploy at HEAD without changes: push an empty commit
        git commit --allow-empty -m "redeploy" && git push
EOF
