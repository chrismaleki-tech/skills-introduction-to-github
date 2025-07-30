#!/bin/bash

# AWS Credentials Setup Script for Rearc Data Quest
echo "🔐 AWS Credentials Setup"
echo "========================"
echo ""

# Check if credentials are already set
if [[ -n "$AWS_ACCESS_KEY_ID" && -n "$AWS_SECRET_ACCESS_KEY" ]]; then
    echo "✓ AWS credentials are already set in environment variables"
    echo "Current AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
    echo ""
    echo "To test credentials, run:"
    echo "source venv/bin/activate && python3 -c \"import boto3; print(boto3.client('sts').get_caller_identity())\""
    exit 0
fi

echo "Please provide your AWS credentials:"
echo "(You can get these from your AWS Console > IAM > Users > Security credentials)"
echo ""

# Prompt for AWS Access Key ID
read -p "AWS Access Key ID: " aws_access_key_id
if [[ -z "$aws_access_key_id" ]]; then
    echo "❌ AWS Access Key ID is required"
    exit 1
fi

# Prompt for AWS Secret Access Key (hidden input)
read -s -p "AWS Secret Access Key: " aws_secret_access_key
echo ""
if [[ -z "$aws_secret_access_key" ]]; then
    echo "❌ AWS Secret Access Key is required"
    exit 1
fi

# Optional: AWS Session Token for temporary credentials
read -p "AWS Session Token (optional, press Enter to skip): " aws_session_token

# Optional: AWS Region
read -p "AWS Region (default: us-east-2): " aws_region
aws_region=${aws_region:-us-east-2}

echo ""
echo "Setting up AWS credentials..."

# Export environment variables
export AWS_ACCESS_KEY_ID="$aws_access_key_id"
export AWS_SECRET_ACCESS_KEY="$aws_secret_access_key"
export AWS_DEFAULT_REGION="$aws_region"

if [[ -n "$aws_session_token" ]]; then
    export AWS_SESSION_TOKEN="$aws_session_token"
fi

# Create .env file for persistence
cat > .env << EOF
# AWS Credentials for Rearc Data Quest
AWS_ACCESS_KEY_ID=$aws_access_key_id
AWS_SECRET_ACCESS_KEY=$aws_secret_access_key
AWS_DEFAULT_REGION=$aws_region
EOF

if [[ -n "$aws_session_token" ]]; then
    echo "AWS_SESSION_TOKEN=$aws_session_token" >> .env
fi

echo "✓ Credentials saved to .env file"
echo "✓ Environment variables set for current session"
echo ""

# Test credentials
echo "Testing credentials..."
source venv/bin/activate
python3 -c "
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

try:
    sts = boto3.client('sts')
    identity = sts.get_caller_identity()
    print('✓ Credentials are valid!')
    print(f'Account ID: {identity.get(\"Account\")}')
    print(f'User ARN: {identity.get(\"Arn\")}')
except Exception as e:
    print(f'❌ Credential test failed: {e}')
    exit(1)
"

echo ""
echo "🎉 AWS credentials setup complete!"
echo ""
echo "To use these credentials in future sessions, run:"
echo "source .env"
echo ""
echo "Or to load them automatically, add this to your ~/.bashrc:"
echo "export \$(grep -v '^#' /workspace/.env | xargs)"