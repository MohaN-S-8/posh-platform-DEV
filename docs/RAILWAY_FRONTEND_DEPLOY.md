# Railway Frontend Deployment

Deploy this after the backend is live and Railway has generated a backend domain.

## 1. Create frontend service

In the same Railway project:

1. Add a new service from the same GitHub repo.
2. Set root directory to `frontend`.
3. Use Dockerfile builder.
4. Keep Dockerfile path as `Dockerfile`.
5. Generate a public domain.

## 2. Frontend variables

Set this on the frontend service:

```env
API_BASE_URL=https://your-backend.up.railway.app/api/v1
```

This is read at container startup and written to `/config.js`, so the frontend can point to the deployed backend without editing React code.

## 3. Backend CORS variables

After Railway generates the frontend domain, update the backend service:

```env
FRONTEND_URL=https://your-frontend.up.railway.app
PUBLIC_APP_URL=https://your-frontend.up.railway.app
BACKEND_CORS_ORIGINS=["https://your-frontend.up.railway.app"]
```

Redeploy the backend after changing these values.

## 4. Verify

Open:

```text
https://your-frontend.up.railway.app
```

Then try login. If the browser reports CORS errors, confirm the backend `BACKEND_CORS_ORIGINS` exactly matches the frontend domain.
