#!/bin/bash

# PeopleConnect Mobile - Test Execution Script
# Usage: ./scripts/run-tests.sh [unit|e2e|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COVERAGE_DIR="$PROJECT_DIR/coverage"
E2E_REPORT_DIR="$PROJECT_DIR/e2e-report"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}PeopleConnect Mobile Test Runner${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Parse arguments
TEST_TYPE="${1:-all}"

run_unit_tests() {
    echo -e "${YELLOW}Running Unit Tests...${NC}"
    echo ""

    cd "$PROJECT_DIR"

    # Run Jest with coverage
    npm test -- --coverage --coverageDirectory="$COVERAGE_DIR" --watchAll=false

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Unit tests passed!${NC}"
    else
        echo -e "${RED}Unit tests failed!${NC}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}Coverage report generated at: $COVERAGE_DIR/lcov-report/index.html${NC}"
    echo ""
}

run_e2e_tests_ios() {
    echo -e "${YELLOW}Running E2E Tests (iOS)...${NC}"
    echo ""

    cd "$PROJECT_DIR"

    # Build iOS app for testing
    echo "Building iOS app..."
    npx detox build -c ios.sim.debug

    # Run E2E tests
    echo "Running E2E tests on iOS simulator..."
    npx detox test -c ios.sim.debug --cleanup

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}iOS E2E tests passed!${NC}"
    else
        echo -e "${RED}iOS E2E tests failed!${NC}"
        exit 1
    fi
}

run_e2e_tests_android() {
    echo -e "${YELLOW}Running E2E Tests (Android)...${NC}"
    echo ""

    cd "$PROJECT_DIR"

    # Build Android app for testing
    echo "Building Android app..."
    npx detox build -c android.emu.debug

    # Run E2E tests
    echo "Running E2E tests on Android emulator..."
    npx detox test -c android.emu.debug --cleanup

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Android E2E tests passed!${NC}"
    else
        echo -e "${RED}Android E2E tests failed!${NC}"
        exit 1
    fi
}

generate_report() {
    echo -e "${YELLOW}Generating Test Report...${NC}"
    echo ""

    # Create report directory
    mkdir -p "$E2E_REPORT_DIR"

    # Copy test execution report template
    if [ -f "$PROJECT_DIR/TEST_EXECUTION_REPORT.md" ]; then
        cp "$PROJECT_DIR/TEST_EXECUTION_REPORT.md" "$E2E_REPORT_DIR/report-$(date +%Y%m%d-%H%M%S).md"
        echo -e "${GREEN}Test report saved to: $E2E_REPORT_DIR${NC}"
    fi

    echo ""
}

show_help() {
    echo "Usage: ./scripts/run-tests.sh [command]"
    echo ""
    echo "Commands:"
    echo "  unit          Run unit tests only"
    echo "  e2e-ios       Run E2E tests on iOS simulator"
    echo "  e2e-android   Run E2E tests on Android emulator"
    echo "  e2e           Run E2E tests on both platforms"
    echo "  all           Run all tests (default)"
    echo "  help          Show this help message"
    echo ""
}

case "$TEST_TYPE" in
    unit)
        run_unit_tests
        ;;
    e2e-ios)
        run_e2e_tests_ios
        generate_report
        ;;
    e2e-android)
        run_e2e_tests_android
        generate_report
        ;;
    e2e)
        run_e2e_tests_ios
        run_e2e_tests_android
        generate_report
        ;;
    all)
        run_unit_tests
        run_e2e_tests_ios
        run_e2e_tests_android
        generate_report
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $TEST_TYPE${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Test Execution Complete${NC}"
echo -e "${GREEN}================================${NC}"
