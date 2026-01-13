---
description: How to deploy Shpole to Fly.io
---

## Deploy to Fly.io

// turbo-all

### First-time Setup

1. Install Fly CLI if not already installed:
```bash
winget install flyctl
```

2. Login to Fly:
```bash
fly auth login
```

3. Create the app (if not exists):
```bash
fly apps create shpole
```

4. Create a persistent volume for SQLite:
```bash
fly volumes create shpole_data --region lax --size 1
```

5. Set JWT secret:
```bash
fly secrets set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
```

### Deploy

6. Deploy the app:
```bash
fly deploy
```

7. Open in browser:
```bash
fly open
```

### Useful Commands

- View logs: `fly logs`
- Check status: `fly status`
- SSH into container: `fly ssh console`
- Restart app: `fly apps restart`