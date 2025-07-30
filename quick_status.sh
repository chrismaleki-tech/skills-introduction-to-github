#!/bin/bash

# Quick Status Check for CDK Bootstrap Issue
echo "🔍 CDK Bootstrap Status Check"
echo "============================="
echo ""

# Set up PATH
export PATH="$HOME/.local/bin:$PATH"

echo "✅ Environment Setup:"
echo "   - AWS CLI: $(aws --version 2>/dev/null || echo 'Not found')"
echo "   - Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "   - CDK: $(cdk --version 2>/dev/null || echo 'Not found')"
echo "   - Python venv: $([ -d "venv" ] && echo 'Created' || echo 'Missing')"
echo ""

echo "❌ Remaining Steps:"
echo "   1. Configure AWS credentials"
echo "   2. Run CDK bootstrap"
echo ""

echo "📋 Quick Commands:"
echo "   Configure credentials: aws configure"
echo "   Fix bootstrap: ./fix_cdk_bootstrap.sh"
echo "   Read guide: cat CDK_BOOTSTRAP_RESOLUTION.md"
echo ""

echo "🎯 Once credentials are set, your CDK bootstrap issue will be resolved!"