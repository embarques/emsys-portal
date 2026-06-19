# EMSYS Portal Deployment

The portal has independent Docker Compose definitions for local and production use.

## Local

From the portal repository root:

```bash
cp environments/local/docker/.env.example environments/local/docker/.env
docker compose \
  --env-file environments/local/docker/.env \
  -f environments/local/docker/compose.yaml \
  up -d --build
```

The portal is published at `http://localhost:3000` and calls the API at
`http://localhost:8080/v1` by default.

## Production

Production uses the shared external Docker network `emsys-net`. Create it once
on the deployment host:

```bash
docker network create emsys-net
```

Configure and start the portal from this repository:

```bash
cp environments/production/docker/.env.example environments/production/docker/.env
docker compose \
  --env-file environments/production/docker/.env \
  -f environments/production/docker/compose.yaml \
  up -d --build
```

The API repository owns Caddy. Its production Caddy configuration routes:

- `https://api.embarqueros.com` to `emsys-api:8080`
- `https://sistem.embarqueros.com` to `emsys-portal:3000`

Both repositories must run their production Compose projects on the same Docker
host and attach their services to `emsys-net`. Only Caddy publishes host ports.

The `NEXT_PUBLIC_*` values are compiled into the Next.js browser bundle during
`docker compose ... up --build`; rebuild the image after changing them.

## Build and push the production image

The push script builds with `environments/production/docker/.env`, logs Docker
into the DigitalOcean registry through `doctl`, and pushes the portal image:

```bash
./scripts/push-prod-image.sh

# Optional immutable tag; this also updates latest.
./scripts/push-prod-image.sh v1.2.3
```

To use a different environment file, set `EMSYS_PORTAL_ENV_FILE` to its path.
