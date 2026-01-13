# Fly.io Deployment

This document describes how to deploy Shpole to Fly.io.

## Prerequisites

1. Install the Fly CLI: https://fly.io/docs/getting-started/installing-flyctl/
2. Sign up for a Fly.io account: `fly auth signup` or `fly auth login`

## First-time Setup

### 1. Create the App

```bash
fly apps create shpole
```

> **Note**: If `shpole` is taken, choose a different name and update `fly.toml` accordingly.

### 2. Create a Persistent Volume

The app uses SQLite for data storage. Create a persistent volume to preserve data:

```bash
fly volumes create shpole_data --region sjc --size 1
```

### 3. Set Environment Variables

```bash
fly secrets set JWT_SECRET=your-super-secret-jwt-key-here
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Deployment

### Deploy the App

```bash
fly deploy
```

This will:
1. Build the Docker image
2. Push it to Fly.io's registry
3. Deploy the app

### Monitor Deployment

```bash
fly status
fly logs
```

## Useful Commands

```bash
# Open the app in browser
fly open

# SSH into the container
fly ssh console

# View logs
fly logs

# Scale the app
fly scale count 1 --region sjc

# Check app status
fly status

# View secrets
fly secrets list
```

## Configuration

### Regions

The app is configured to run in `sjc` (San Jose). To change regions, update `fly.toml`:

```toml
primary_region = 'lax'  # or any other region
```

### Scaling

The app is configured with:
- 512MB RAM
- 1 shared CPU
- Auto-stop when idle (scales to 0 when not in use)
- Minimum 0 machines running

To keep at least one machine running:
```toml
min_machines_running = 1
```

## Troubleshooting

### Database Issues

If you need to reset the database:
```bash
fly ssh console
rm /app/data/shpole.db
exit
fly apps restart
```

### Build Failures

If native modules fail to build, ensure the Dockerfile has:
```dockerfile
RUN apk add --no-cache python3 make g++
```

### Connection Issues

Check health endpoint:
```bash
curl https://shpole.fly.dev/api/health
```

## Local Testing with Docker

```bash
# Build the image
docker build -t shpole .

# Run locally
docker run -p 8080:8080 -v $(pwd)/data:/app/data shpole

# Open http://localhost:8080
```
