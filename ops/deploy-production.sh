#!/bin/sh
# Run as root on JING. Archives must come from the reviewed fork commit.
# --check-only is safe during a match. An active match always blocks deployment.
set -eu
check_idle() {
    curl --max-time 5 -fsS http://127.0.0.1:3810/healthz |
        node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const h=JSON.parse(s);if(h.ok!==true||!Number.isInteger(h.matches)||h.matches<0)throw Error("invalid health response");if(h.matches>0){console.error("Deployment blocked: "+h.matches+" active match(es). No files changed or service stopped.");process.exit(20)}console.log("Production idle; build "+h.build)}catch(e){console.error(e.message);process.exit(21)}})'
}
if [ "${1:-}" = --check-only ]; then check_idle; exit 0; fi
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo 'Usage: deploy-production.sh --check-only | CODE.tar.gz [ASSETS.tar.gz]' >&2
    exit 2
fi
code=$(realpath "$1")
assets=''
if [ "$#" -eq 2 ]; then assets=$(realpath "$2"); fi
test -f "$code"
if [ -n "$assets" ]; then test -f "$assets"; fi
# Serialize deployment, and fail before touching production if either archive is corrupt.
exec 9>/run/lock/sp2-deploy.lock
flock -n 9
tar -tzf "$code" >/dev/null
if [ -n "$assets" ]; then tar -tzf "$assets" >/dev/null; fi
check_idle
backup=$(mktemp -d /opt/sp2/backups/deploy-XXXXXXXX)
tar -czf "$backup/code.tar.gz" -C /opt/sp2 \
    --exclude=./public/assets --exclude=./public/fonts --exclude=./public/vendor \
    --exclude=./public/client --exclude=./node_modules --exclude=./.git \
    --exclude=./.cache --exclude=./backups --exclude=./.backups .
# Recheck immediately before stopping: a match may have started during backup.
check_idle
rollback() {
    systemctl stop sp2.service
    tar -xzf "$backup/code.tar.gz" -C /opt/sp2
    systemctl start sp2.service
    echo "Deployment failed; previous code restored from $backup" >&2
}
systemctl stop sp2.service
if ! tar -xzf "$code" -C /opt/sp2; then rollback; exit 1; fi
if [ -n "$assets" ] && ! tar -xzf "$assets" -C /opt/sp2; then rollback; exit 1; fi
chown -R sp2:sp2 /opt/sp2/server /opt/sp2/shared /opt/sp2/data /opt/sp2/public/js /opt/sp2/public/css /opt/sp2/public/i18n
systemctl start sp2.service
attempt=0
until curl --max-time 3 -fsS http://127.0.0.1:3810/healthz; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 10 ]; then rollback; exit 1; fi
    sleep 1
done
printf '\nDeployed; previous code: %s\n' "$backup"
