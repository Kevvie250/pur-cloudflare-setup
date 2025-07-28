#!/bin/bash

# Test script for the PurAir Cloudflare Setup CLI

echo "🧪 Testing PurAir Cloudflare Setup CLI"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test function
test_command() {
    local description=$1
    local command=$2
    
    echo -e "\n${BLUE}Test: ${description}${NC}"
    echo "Command: $command"
    echo "---"
    
    if eval "$command"; then
        echo -e "${GREEN}✓ Passed${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
    fi
}

# Change to project directory
cd "$(dirname "$0")/.."

# Test 1: Help command
test_command "Display help" "node setup.js --help"

# Test 2: Version command
test_command "Display version" "node setup.js --version"

# Test 3: List configurations
test_command "List saved configurations" "node setup.js config --list"

# Test 4: Non-interactive mode with all required options
test_command "Non-interactive setup" "node setup.js --name test-project --domain test.example.com --type site --no-interactive"

# Test 5: Load example configuration
test_command "Load example configuration" "node setup.js --config config/example.json --no-interactive"

echo -e "\n${BLUE}======================================"
echo -e "Testing complete!${NC}\n"