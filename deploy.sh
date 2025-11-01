#!/bin/bash

# Deploy TypeScript Game to Google Cloud Run
# Usage: ./deploy.sh

set -e

# Configuration
PROJECT_ID="steve-game-476911"
SERVICE_NAME="steve-game"
REGION="europe-west1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Starting deployment to Cloud Run..."
echo "📦 Project: ${PROJECT_ID}"
echo "🎮 Service: ${SERVICE_NAME}"
echo "🌍 Region: ${REGION}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set the project
echo "🔧 Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs (if not already enabled)
echo "🔌 Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com --quiet

# Build and push the container image using Cloud Build
echo "🏗️  Building container image with Cloud Build..."
gcloud builds submit --tag ${IMAGE_NAME} --timeout=10m

# Deploy to Cloud Run
echo "🚢 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 3600 \
  --set-env-vars "NODE_ENV=production" \
  --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "🎮 Game URL: ${SERVICE_URL}"
echo ""
echo "📊 View logs:"
echo "   gcloud logs tail --project=${PROJECT_ID} --service=${SERVICE_NAME}"
echo ""
echo "📈 View service details:"
echo "   gcloud run services describe ${SERVICE_NAME} --region ${REGION}"
echo ""
