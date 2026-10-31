#!/usr/bin/env bash
# Production operations on the Vercel REST API for deploy.yml. The deploy token is scoped
# to the `app` project, and the CLI's inspect, promote and rollback need a user, so these
# calls go straight to the project endpoints.
#
#   current             prints the id of the deployment serving production
#   deployment-id URL   prints the id of a deployment from its URL
#   promote ID          promotes ID and waits until it serves production
#   rollback ID         rolls production back to ID
#
# Needs VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID.
set -euo pipefail

api() {
  curl -fsS -H "Authorization: Bearer $VERCEL_TOKEN" "$@"
}

project_url="https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID?teamId=$VERCEL_ORG_ID"

current() {
  api "$project_url" | jq -r '.targets.production.id // empty'
}

case "${1:-}" in
  current)
    current
    ;;
  deployment-id)
    host="${2#https://}"
    api "https://api.vercel.com/v13/deployments/$host?teamId=$VERCEL_ORG_ID" | jq -r '.id // empty'
    ;;
  promote)
    target="$2"
    if [ "$(current)" != "$target" ]; then
      api -X POST "https://api.vercel.com/v10/projects/$VERCEL_PROJECT_ID/promote/$target?teamId=$VERCEL_ORG_ID" >/dev/null
    fi
    for _ in $(seq 1 24); do
      [ "$(current)" = "$target" ] && { echo "Production serves $target."; exit 0; }
      sleep 5
    done
    echo "Production still serves '$(current)', expected '$target'." >&2
    exit 1
    ;;
  rollback)
    api -X POST "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID/rollback/$2?teamId=$VERCEL_ORG_ID" >/dev/null
    echo "Rolled production back to $2."
    ;;
  *)
    echo "usage: $0 current | deployment-id URL | promote ID | rollback ID" >&2
    exit 2
    ;;
esac
