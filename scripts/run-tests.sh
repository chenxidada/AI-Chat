#!/bin/bash

# Automated Test Runner for Knowledge Base Project
# Usage: ./scripts/run-tests.sh [options]
# Options:
#   --api-only      Only run API tests
#   --e2e-only      Only run E2E frontend tests
#   --unit-only     Only run backend unit tests
#   --report        Generate HTML report
#   --help          Show this help

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
API_ONLY=false
E2E_ONLY=false
UNIT_ONLY=false
GENERATE_REPORT=false

for arg in "$@"; do
  case $arg in
    --api-only)
      API_ONLY=true
      shift
      ;;
    --e2e-only)
      E2E_ONLY=true
      shift
      ;;
    --unit-only)
      UNIT_ONLY=true
      shift
      ;;
    --report)
      GENERATE_REPORT=true
      shift
      ;;
    --help)
      echo "Usage: ./scripts/run-tests.sh [options]"
      echo "Options:"
      echo "  --api-only      Only run API tests"
      echo "  --e2e-only      Only run E2E frontend tests"
      echo "  --unit-only     Only run backend unit tests"
      echo "  --report        Generate HTML report"
      echo "  --help          Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Knowledge Base - Automated Tests${NC}"
echo -e "${BLUE}========================================${NC}"

cd "$PROJECT_ROOT"

# Check if servers are running
check_api_server() {
  echo -e "\n${YELLOW}[1/4] Checking API server...${NC}"
  if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API server is running${NC}"
    return 0
  else
    echo -e "${RED}✗ API server is not running${NC}"
    echo -e "  Start with: ${YELLOW}pnpm dev:api${NC}"
    return 1
  fi
}

check_web_server() {
  echo -e "\n${YELLOW}[2/4] Checking Web server...${NC}"
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Web server is running${NC}"
    return 0
  else
    echo -e "${RED}✗ Web server is not running${NC}"
    echo -e "  Start with: ${YELLOW}pnpm dev:web${NC}"
    return 1
  fi
}

# Run backend unit tests
run_unit_tests() {
  echo -e "\n${YELLOW}[3/4] Running Backend Unit Tests...${NC}"
  cd "$PROJECT_ROOT/apps/api"

  if [ -f "node_modules/.bin/jest" ]; then
    node_modules/.bin/jest --passWithNoTests 2>&1 || true
  else
    echo -e "${YELLOW}⚠ Jest not found, skipping unit tests${NC}"
  fi

  cd "$PROJECT_ROOT"
}

# Run Playwright E2E tests
run_e2e_tests() {
  echo -e "\n${YELLOW}[4/4] Running E2E Tests...${NC}"

  REPORTER_ARG="list"
  if [ "$GENERATE_REPORT" = true ]; then
    REPORTER_ARG="html"
  fi

  # Build test command
  TEST_CMD="node node_modules/@playwright/test/cli.js test --reporter=$REPORTER_ARG"

  if [ "$API_ONLY" = true ]; then
    TEST_CMD="$TEST_CMD --grep 'Images API|API Health'"
  elif [ "$E2E_ONLY" = true ]; then
    TEST_CMD="$TEST_CMD --grep-invert 'Images API|API Health'"
  fi

  echo -e "Running: ${BLUE}$TEST_CMD${NC}\n"
  eval $TEST_CMD || true

  if [ "$GENERATE_REPORT" = true ]; then
    echo -e "\n${GREEN}HTML Report generated at: ${YELLOW}playwright-report/index.html${NC}"
    echo -e "Open with: ${BLUE}npx playwright show-report${NC}"
  fi
}

# Main execution
main() {
  API_RUNNING=false
  WEB_RUNNING=false

  # Check servers unless unit-only
  if [ "$UNIT_ONLY" = false ]; then
    check_api_server && API_RUNNING=true || true
    check_web_server && WEB_RUNNING=true || true

    if [ "$API_ONLY" = true ] && [ "$API_RUNNING" = false ]; then
      echo -e "\n${RED}Error: API server required for --api-only tests${NC}"
      exit 1
    fi

    if [ "$E2E_ONLY" = true ] && [ "$WEB_RUNNING" = false ]; then
      echo -e "\n${RED}Error: Web server required for --e2e-only tests${NC}"
      exit 1
    fi
  fi

  # Run tests based on options
  if [ "$UNIT_ONLY" = true ]; then
    run_unit_tests
  elif [ "$API_ONLY" = true ]; then
    run_e2e_tests
  elif [ "$E2E_ONLY" = true ]; then
    run_e2e_tests
  else
    run_unit_tests
    run_e2e_tests
  fi

  echo -e "\n${GREEN}========================================${NC}"
  echo -e "${GREEN}   Test Execution Complete${NC}"
  echo -e "${GREEN}========================================${NC}"
}

main
