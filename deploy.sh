#!/bin/bash

# ============================================
# Dooza AI - Deploy Script
# ============================================
# Deploys frontend to Vercel, backend to Render
# Usage: ./deploy.sh [frontend|backend|all]
# ============================================

set -e

# Load deployment keys
if [ -f ".deploy-keys" ]; then
  source .deploy-keys
else
  echo "Error: .deploy-keys not found"
  exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
echo_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =====================
# FRONTEND (Vercel)
# =====================
deploy_frontend() {
  echo_info "Deploying frontend to Vercel..."

  cd apps/web

  # Build first to catch errors
  echo_info "Building frontend..."
  npm run build

  # Deploy to Vercel
  echo_info "Pushing to Vercel..."
  vercel --prod --yes --token "$VERCEL_TOKEN"

  cd ../..
  echo_success "Frontend deployed to Vercel"
}

# =====================
# BACKEND (Render)
# =====================
deploy_backend() {
  echo_info "Deploying backend to Render..."

  # Trigger deploy via Render API
  RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys")

  DEPLOY_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$DEPLOY_ID" ]; then
    echo_success "Backend deploy triggered (ID: $DEPLOY_ID)"
    echo_info "Monitor at: https://dashboard.render.com/web/$RENDER_SERVICE_ID"
  else
    echo_error "Failed to trigger deploy"
    echo "$RESPONSE"
    exit 1
  fi
}

# =====================
# GIT PUSH
# =====================
git_push() {
  echo_info "Pushing to GitHub..."

  # Check for uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    echo_info "Uncommitted changes found. Committing..."
    git add -A
    git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
  fi

  git push origin main
  echo_success "Pushed to GitHub"
}

# =====================
# HEALTH CHECK
# =====================
check_health() {
  echo_info "Checking service health..."

  # Check backend
  echo_info "Backend health check..."
  BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" || echo "000")
  if [ "$BACKEND_STATUS" = "200" ]; then
    echo_success "Backend is healthy"
  else
    echo_error "Backend returned $BACKEND_STATUS"
  fi

  # Check frontend
  echo_info "Frontend health check..."
  FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
  if [ "$FRONTEND_STATUS" = "200" ]; then
    echo_success "Frontend is healthy"
  else
    echo_error "Frontend returned $FRONTEND_STATUS"
  fi
}

# =====================
# MAIN
# =====================
case "${1:-all}" in
  frontend)
    deploy_frontend
    ;;
  backend)
    git_push
    deploy_backend
    ;;
  health)
    check_health
    ;;
  all)
    git_push
    deploy_frontend
    deploy_backend
    echo ""
    echo_info "Waiting 10s before health check..."
    sleep 10
    check_health
    ;;
  *)
    echo "Usage: ./deploy.sh [frontend|backend|health|all]"
    exit 1
    ;;
esac

echo ""
echo_success "Done!"
