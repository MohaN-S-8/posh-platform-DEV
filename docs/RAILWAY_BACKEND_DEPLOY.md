# Railway Backend Deployment

Deploy the backend first, then connect the Vercel frontend to the Railway URL.

## 1. Create Railway services

In Railway:

1. Create a new project from the GitHub repository.
2. Add a backend service.
3. Set the service root directory to `backend`.
4. Railway should detect `backend/Dockerfile`.
5. Add Railway MySQL.
6. Add Railway Redis.
7. Optional: add a second backend-based service for Celery.

## 2. Backend variables

Set these on the Railway backend service. Use Railway references or paste the values from the MySQL/Redis services.

```env
APP_ENV=production
DATABASE_URL=mysql+asyncmy://USER:PASSWORD@HOST:PORT/DATABASE
REDIS_URL=redis://default:PASSWORD@HOST:PORT
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

FRONTEND_URL=https://your-frontend.vercel.app
PUBLIC_APP_URL=https://your-frontend.vercel.app
BACKEND_CORS_ORIGINS=["https://your-frontend.vercel.app"]

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
EMAILS_FROM=your-email@example.com
```

For object storage, prefer S3 or Cloudflare R2. The current code uses S3-compatible variable names:

```env
MINIO_ENDPOINT=https://your-s3-compatible-endpoint
MINIO_PUBLIC_ENDPOINT=https://your-s3-compatible-public-endpoint
MINIO_ROOT_USER=your-access-key
MINIO_ROOT_PASSWORD=your-secret-key
S3_REGION=auto
MINIO_BUCKET_VIDEOS=posh-videos
MINIO_BUCKET_CERTIFICATES=posh-certificates
```

For the `storageapi.dev` bucket shared during setup, use:

```env
MINIO_ENDPOINT=https://t3.storageapi.dev
MINIO_PUBLIC_ENDPOINT=https://t3.storageapi.dev
MINIO_ROOT_USER=<Access Key ID>
MINIO_ROOT_PASSWORD=<Secret Access Key>
S3_REGION=auto
MINIO_BUCKET_VIDEOS=stored-pocket-3ojdexqqnw0
MINIO_BUCKET_CERTIFICATES=stored-pocket-3ojdexqqnw0
```

Using the same bucket for videos and certificates is okay. The app stores files under different object-key prefixes.

## 3. Celery worker

Create another Railway service from the same repo/root `backend`, then override the start command:

```bash
celery -A app.workers.celery_app worker --loglevel=info
```

Use the same `DATABASE_URL`, `REDIS_URL`, JWT, email, and storage variables as the backend.

## 4. Verify backend

After Railway deploys the backend, open:

```text
https://your-backend.up.railway.app/health
https://your-backend.up.railway.app/docs
```

If `/health` returns `{"status":"ok","app":"POSH Training Platform"}`, the backend is live.

## 5. Important security note

Do not reuse local development secrets in Railway. Rotate any SMTP app password or secret that has been shared in local `.env` before production.
