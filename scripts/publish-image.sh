#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE_REPOSITORY:?}" "${GIT_SHA:?}" "${ENVIRONMENT:?}"
: "${GITHUB_OUTPUT:?}" "${GITHUB_STEP_SUMMARY:?}" "${PUBLICATION_METADATA:?}"
[[ "$GIT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$ENVIRONMENT" == dev || "$ENVIRONMENT" == master ]]
version="$IMAGE_REPOSITORY:$GIT_SHA"
error_file=$(mktemp)
trap 'rm -f "$error_file"' EXIT

# A failed registry request is not proof that the version is absent.
if manifest=$(docker buildx imagetools inspect "$version" --format '{{json .Manifest}}' 2>"$error_file"); then
  echo "Reusing $version"
else
  if ! grep -Eq ': not found$' "$error_file"; then
    cat "$error_file" >&2
    exit 1
  fi
  # No branch-specific target or build arguments: the same SHA has one version.
  docker buildx build --platform linux/amd64 --file Dockerfile --tag "$version" --push .
  manifest=$(docker buildx imagetools inspect "$version" --format '{{json .Manifest}}')
fi

digest=$(jq -er '.digest' <<< "$manifest")
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
image="$IMAGE_REPOSITORY@$digest"
# Update only the convenience alias; never rewrite an existing SHA version.
docker buildx imagetools create --prefer-index=false --tag "$IMAGE_REPOSITORY:$ENVIRONMENT" "$image"
printf 'Обновлён тег %s:%s -> %s\n' "$IMAGE_REPOSITORY" "$ENVIRONMENT" "$digest"
jq -n --arg image "$image" --arg tag "$version" --arg sha "$GIT_SHA" \
  --arg environment "$ENVIRONMENT" \
  '{image: $image, tag: $tag, sha: $sha, environment: $environment}' > "$PUBLICATION_METADATA"
printf 'image=%s\n' "$image" >> "$GITHUB_OUTPUT"
printf '### Published fm-ui\n\n- Image: `%s`\n- Version: `%s`\n- SHA: `%s`\n- Environment: `%s`\n' \
  "$image" "$version" "$GIT_SHA" "$ENVIRONMENT" >> "$GITHUB_STEP_SUMMARY"
