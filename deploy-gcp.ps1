# deploy-gcp.ps1
# Automated Google Cloud Deployment Script for RevRecover

$PROJECT_ID  = "revrecovertinyfish"
$REGION      = "us-east1"

# Hardcoded stable backend URL - avoids PowerShell gcloud variable-capture bug
$BACKEND_URL = "https://revrecover-backend-xxbt223iwa-ue.a.run.app"
$IMAGE_URL   = "us-east1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/revrecover-frontend"

Write-Host "Starting deployment to project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

Write-Host "Enabling required GCP APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Build Frontend image via Cloud Build (bakes VITE_API_URL into the JS bundle)
Write-Host "Building Frontend image via Cloud Build..."
Write-Host "  VITE_API_URL = $BACKEND_URL"
gcloud builds submit --config cloudbuild.yaml --substitutions="_BACKEND_URL=$BACKEND_URL" .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cloud Build failed. Aborting."
    exit 1
}

Write-Host "Cloud Build succeeded. Deploying to Cloud Run..."
gcloud run deploy revrecover-frontend `
    --image $IMAGE_URL `
    --region $REGION `
    --project $PROJECT_ID `
    --allow-unauthenticated

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cloud Run deploy failed."
    exit 1
}

Write-Host ""
Write-Host "Deployment Complete!"
Write-Host "Backend URL  : $BACKEND_URL"
Write-Host "Frontend URL : https://revrecover-frontend-xxbt223iwa-ue.a.run.app"
