#!/bin/bash
# deploy-gcp.sh
# Mac/Linux Automated Google Cloud Deployment Script for RevRecover
# Usage: bash deploy-gcp.sh

set -e  # Exit on any error

PROJECT_ID="revrecovertinyfish"
REGION="us-east1"
GCLOUD="/usr/local/bin/gcloud"

# Backend URL (stable - from existing Cloud Run service)
BACKEND_URL="https://revrecover-backend-xxbt223iwa-ue.a.run.app"

# Image URLs
FRONTEND_IMAGE="us-east1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/revrecover-frontend"
BACKEND_IMAGE="us-east1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/revrecover-backend"

echo "================================================"
echo "  RevRecover → GCP Deployment"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "================================================"

# Set active project
$GCLOUD config set project $PROJECT_ID

# Enable required APIs
echo ""
echo "[1/4] Enabling required GCP APIs..."
$GCLOUD services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --quiet

# ── BACKEND ──────────────────────────────────────────────────────────────────
echo ""
echo "[2/4] Building & pushing Backend image via Cloud Build..."
$GCLOUD builds submit ./backend \
  --tag "$BACKEND_IMAGE" \
  --project "$PROJECT_ID"

echo "Deploying Backend to Cloud Run..."
$GCLOUD run deploy revrecover-backend \
  --image "$BACKEND_IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --port 3001 \
  --set-env-vars "TINYFISH_API_KEY=\${TINYFISH_API_KEY}" \
  --set-env-vars "MONGODB_URI=\${MONGODB_URI}" \
  --set-env-vars "CMS_CLIENT_ID=\${CMS_CLIENT_ID}" \
  --set-env-vars "CMS_CLIENT_SECRET=\${CMS_CLIENT_SECRET}" \
  --set-env-vars "CMS_REDIRECT_URI=https://revrecover-frontend-545512617230.us-east1.run.app/cms-callback" \
  --set-env-vars "CMS_SANDBOX_BASE=https://sandbox.bluebutton.cms.gov"

# Capture actual backend URL after deploy
BACKEND_URL=$($GCLOUD run services describe revrecover-backend \
  --region "$REGION" --project "$PROJECT_ID" \
  --format="value(status.url)")
echo "Backend live at: $BACKEND_URL"

# ── FRONTEND ─────────────────────────────────────────────────────────────────
echo ""
echo "[3/4] Building Frontend image (baking VITE_API_URL=$BACKEND_URL)..."
$GCLOUD builds submit . \
  --config cloudbuild.yaml \
  --substitutions="_BACKEND_URL=$BACKEND_URL" \
  --project "$PROJECT_ID"

echo ""
echo "[4/4] Deploying Frontend to Cloud Run..."
$GCLOUD run deploy revrecover-frontend \
  --image "$FRONTEND_IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated

FRONTEND_URL=$($GCLOUD run services describe revrecover-frontend \
  --region "$REGION" --project "$PROJECT_ID" \
  --format="value(status.url)")

echo ""
echo "================================================"
echo "  ✅ Deployment Complete!"
echo "  Backend  : $BACKEND_URL"
echo "  Frontend : $FRONTEND_URL"
echo "================================================"
