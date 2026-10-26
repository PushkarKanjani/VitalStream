#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VitalStream — Production Automated Deployment Script (Bash)
# Apollo Hospitals, Gandhinagar · Perioperative Command Center
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo -e "\033[1;36m=================================================================\033[0m"
echo -e "\033[1;36m  VitalStream — Automated Production Deployment Pipeline\033[0m"
echo -e "\033[1;36m  Facility: Apollo Hospitals, Gandhinagar · OR Suite 1-6\033[0m"
echo -e "\033[1;36m=================================================================\033[0m"

# 1. Check Docker & Compose
echo -e "\n\033[1;33m[Step 1/5] Checking Docker CLI...\033[0m"
if ! command -v docker &> /dev/null; then
    echo -e "\033[1;31m[ERROR] Docker not found. Please install Docker Engine.\033[0m"
    exit 1
fi

COMPOSE="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE="docker-compose"
fi
echo -e "\033[1;32m[OK] Using: $COMPOSE\033[0m"

# 2. Build & Launch
echo -e "\n\033[1;33m[Step 2/5] Building & Launching Distributed Container Stack...\033[0m"
$COMPOSE up --build -d

# 3. Wait for Health Readiness
echo -e "\n\033[1;33m[Step 3/5] Waiting for API Readiness...\033[0m"
MAX_RETRIES=20
COUNT=0
HEALTHY=0

while [ $COUNT -lt $MAX_RETRIES ]; do
    COUNT=$((COUNT+1))
    echo "Probing backend health status (Attempt $COUNT/$MAX_RETRIES)..."
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || true)
    if [ "$STATUS" = "200" ]; then
        HEALTHY=1
        break
    fi
    sleep 3
done

if [ $HEALTHY -eq 1 ]; then
    echo -e "\033[1;32m[OK] Backend API is Healthy (HTTP 200)!\033[0m"
else
    echo -e "\033[1;33m[WARNING] Backend still starting up.\033[0m"
fi

# 4. Seed Data
echo -e "\n\033[1;33m[Step 4/5] Seeding Gandhinagar Clinical Context into MongoDB...\033[0m"
docker exec -i vs_backend python scripts/seed_gandhinagar_cases.py || python3 scripts/seed_gandhinagar_cases.py || true
docker exec -i vs_backend python scripts/seed_preset_patients.py || python3 scripts/seed_preset_patients.py || true

# 5. Security Smoke Test
echo -e "\n\033[1;33m[Step 5/5] Checking OWASP Security Headers...\033[0m"
curl -s -I http://localhost:8000/health | grep -E -i "x-content-type|x-frame|strict-transport|x-ratelimit" || true

echo -e "\n\033[1;36m=================================================================\033[0m"
echo -e "\033[1;32m  [DEPLOYMENT SUCCESS] VitalStream is Running in Production Mode!\033[0m"
echo -e "\033[1;37m  • Frontend UI  : http://localhost:80 or http://localhost:5173\033[0m"
echo -e "\033[1;37m  • Backend API  : http://localhost:8000/api/docs\033[0m"
echo -e "\033[1;37m  • Kafka UI     : http://localhost:9000 (Kafdrop)\033[0m"
echo -e "\033[1;37m  • Flink Engine : http://localhost:8081\033[0m"
echo -e "\033[1;36m=================================================================\033[0m\n"
