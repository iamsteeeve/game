# Cloud Run Deployment Guide

## Prerequisites

1. **Install Google Cloud SDK**:

   ```bash
   # macOS
   brew install --cask google-cloud-sdk

   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate with Google Cloud**:

   ```bash
   gcloud auth login
   ```

3. **Verify your project**:
   ```bash
   gcloud config get-value project
   # Should show: steve-game-476911
   ```

## Deploy to Cloud Run

### Quick Deploy

Simply run:

```bash
./deploy.sh
```

This script will:

- Build the Docker container using Google Cloud Build
- Deploy to Cloud Run in `europe-west1`
- Configure the service with proper settings
- Return the public URL

### Manual Deploy (if needed)

1. **Build and push the container**:

   ```bash
   gcloud builds submit --tag gcr.io/steve-game-476911/steve-game
   ```

2. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy steve-game \
     --image gcr.io/steve-game-476911/steve-game \
     --platform managed \
     --region europe-west1 \
     --allow-unauthenticated \
     --port 8080 \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 10 \
     --timeout 3600 \
     --set-env-vars "NODE_ENV=production"
   ```

## Post-Deployment

### View Logs

```bash
gcloud logs tail --project=steve-game-476911 --service=steve-game
```

### View Service Details

```bash
gcloud run services describe steve-game --region europe-west1
```

### Update Service

To update after code changes, simply run `./deploy.sh` again.

## Architecture

- **Client**: Built with Vite, served as static files
- **Server**: Express + Socket.IO, handles multiplayer sync
- **Connection**: Client automatically connects to the same host (Cloud Run URL)
- **WebSockets**: Fully supported by Cloud Run

## Configuration

- **Port**: 8080 (required by Cloud Run)
- **Memory**: 512Mi
- **CPU**: 1
- **Timeout**: 60 minutes (for WebSocket connections)
- **Auto-scaling**: 0 to 10 instances

## Notes

- Cloud Run scales to zero when no traffic (cost-effective)
- First request after scale-to-zero may take a few seconds (cold start)
- WebSocket connections maintained but server state is not persistent
- Consider adding Redis/Memorystore for persistent game state if needed
