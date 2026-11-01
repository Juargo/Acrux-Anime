#!/usr/bin/env bash
# Weekly production backup for backup.yml: pg_dump, encrypted with age, uploaded to the
# private B2 bucket. Plain data only exists inside the pipe. The object is uploaded after
# the dump finishes, so a failed dump never leaves a partial backup in the bucket.
#
# Needs DATABASE_URL_BACKUP, AGE_RECIPIENT, B2_BUCKET, B2_ENDPOINT, AWS_ACCESS_KEY_ID and
# AWS_SECRET_ACCESS_KEY. PG_DUMP overrides the pg_dump binary.
set -euo pipefail

: "${DATABASE_URL_BACKUP:?}" "${AGE_RECIPIENT:?}" "${B2_BUCKET:?}" "${B2_ENDPOINT:?}"

encrypted="$(mktemp)"
trap 'rm -f "$encrypted"' EXIT

key="acrux-$(date -u +%Y-%m-%dT%H%M%SZ).dump.age"

"${PG_DUMP:-pg_dump}" --format=custom --dbname="$DATABASE_URL_BACKUP" \
  | age --recipient "$AGE_RECIPIENT" --output "$encrypted"

aws s3 cp --no-progress "$encrypted" "s3://$B2_BUCKET/$key" --endpoint-url "$B2_ENDPOINT"

size="$(aws s3api head-object --bucket "$B2_BUCKET" --key "$key" \
  --endpoint-url "$B2_ENDPOINT" --query ContentLength --output text)"
if [ "$size" != "$(wc -c <"$encrypted" | tr -d ' ')" ]; then
  echo "Uploaded $size bytes for $key, expected the size of the local file." >&2
  exit 1
fi

echo "Stored $key ($size bytes)."
