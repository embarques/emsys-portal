#!/usr/bin/env bash
# Build and push emsys-portal to DigitalOcean Container Registry.
# Run from anywhere; the script resolves the repository root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT}/environments/production/docker/compose.yaml"
ENV_FILE="${EMSYS_PORTAL_ENV_FILE:-${ROOT}/environments/production/docker/.env}"
REGISTRY="registry.digitalocean.com/embrepo"
IMAGE="${REGISTRY}/emsys-portal"
TAG="${1:-latest}"

if ! command -v doctl >/dev/null 2>&1; then
  echo "doctl is not installed." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not on PATH." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Production environment file not found: ${ENV_FILE}" >&2
  echo "Copy environments/production/docker/.env.example to .env and configure it first." >&2
  exit 1
fi

cd "${ROOT}"

echo "Logging into DigitalOcean Container Registry..."
doctl registry login

echo "Building ${IMAGE}:latest with ${ENV_FILE}..."
docker compose \
  --env-file "${ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  build emsys-portal

if [[ "${TAG}" != "latest" ]]; then
  echo "Tagging ${IMAGE}:latest as ${IMAGE}:${TAG}..."
  docker tag "${IMAGE}:latest" "${IMAGE}:${TAG}"
fi

echo "Pushing ${IMAGE}:${TAG}..."
docker push "${IMAGE}:${TAG}"

if [[ "${TAG}" != "latest" ]]; then
  echo "Pushing ${IMAGE}:latest..."
  docker push "${IMAGE}:latest"
fi

echo "Done. On the production server, deploy with:"
echo "  docker compose --env-file environments/production/docker/.env -f environments/production/docker/compose.yaml pull emsys-portal"
echo "  docker compose --env-file environments/production/docker/.env -f environments/production/docker/compose.yaml up -d --no-build emsys-portal"
