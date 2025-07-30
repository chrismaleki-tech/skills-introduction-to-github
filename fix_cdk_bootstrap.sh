#!/bin/bash

# CDK Bootstrap Fix Script for Rearc Data Quest
# This script addresses the CDK bootstrap error you encountered

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 CDK Bootstrap Fix Script${NC}"
echo -e "${BLUE}===========================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Set up PATH for pipx and CDK
export PATH="$HOME/.local/bin:$PATH"

# Check if we're in virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    print_warning "Activating Python virtual environment..."
    source venv/bin/activate
fi

# Check AWS CLI
if command -v aws &> /dev/null; then
    print_status "AWS CLI is installed"
else
    print_error "AWS CLI not found. Please run the installation steps first."
    exit 1
fi

# Check CDK
if command -v cdk &> /dev/null; then
    CDK_VER=$(cdk --version)
    print_status "AWS CDK $CDK_VER is installed"
else
    print_error "AWS CDK not found. Please run: npm install -g aws-cdk@latest"
    exit 1
fi

echo ""
echo -e "${BLUE}Checking AWS Credentials...${NC}"

# Check for environment variables
if [[ -n "$AWS_ACCESS_KEY_ID" && -n "$AWS_SECRET_ACCESS_KEY" ]]; then
    print_status "AWS credentials found in environment variables"
    
    # Test credentials
    if aws sts get-caller-identity &> /dev/null; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        AWS_REGION="${AWS_DEFAULT_REGION:-us-east-2}"
        print_status "AWS credentials are valid for account: $ACCOUNT_ID"
        
        echo ""
        echo -e "${BLUE}Running CDK Bootstrap...${NC}"
        cd part4_infrastructure/cdk
        
        # Set CDK environment variables
        export CDK_DEFAULT_ACCOUNT=$ACCOUNT_ID
        export CDK_DEFAULT_REGION=$AWS_REGION
        
        echo "Bootstrapping CDK for account $ACCOUNT_ID in region $AWS_REGION..."
        
        if cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION"; then
            print_status "CDK bootstrap completed successfully!"
            echo ""
            echo -e "${GREEN}🎉 CDK Bootstrap Fixed!${NC}"
            echo ""
            echo "You can now deploy your CDK stack:"
            echo "cd part4_infrastructure/cdk"
            echo "cdk deploy"
        else
            print_error "CDK bootstrap failed"
            exit 1
        fi
    else
        print_error "AWS credentials are not valid"
        exit 1
    fi
elif [[ -f "$HOME/.aws/credentials" || -f "$HOME/.aws/config" ]]; then
    print_status "AWS credentials found in ~/.aws/ directory"
    
    if aws sts get-caller-identity &> /dev/null; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        AWS_REGION="${AWS_DEFAULT_REGION:-us-east-2}"
        print_status "AWS credentials are valid for account: $ACCOUNT_ID"
        
        echo ""
        echo -e "${BLUE}Running CDK Bootstrap...${NC}"
        cd part4_infrastructure/cdk
        
        # Set CDK environment variables
        export CDK_DEFAULT_ACCOUNT=$ACCOUNT_ID
        export CDK_DEFAULT_REGION=$AWS_REGION
        
        echo "Bootstrapping CDK for account $ACCOUNT_ID in region $AWS_REGION..."
        
        if cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION"; then
            print_status "CDK bootstrap completed successfully!"
            echo ""
            echo -e "${GREEN}🎉 CDK Bootstrap Fixed!${NC}"
            echo ""
            echo "You can now deploy your CDK stack:"
            echo "cd part4_infrastructure/cdk"
            echo "cdk deploy"
        else
            print_error "CDK bootstrap failed"
            exit 1
        fi
    else
        print_error "AWS credentials are not valid"
        exit 1
    fi
else
    print_error "No AWS credentials found"
    echo ""
    echo -e "${YELLOW}To fix this issue, you need to configure AWS credentials. Here are your options:${NC}"
    echo ""
    echo "Option 1: Use AWS CLI configuration"
    echo "  aws configure"
    echo ""
    echo "Option 2: Set environment variables"
    echo "  export AWS_ACCESS_KEY_ID='your-access-key'"
    echo "  export AWS_SECRET_ACCESS_KEY='your-secret-key'"
    echo "  export AWS_DEFAULT_REGION='us-east-2'"
    echo ""
    echo "Option 3: Use the provided setup script"
    echo "  ./setup_credentials.sh"
    echo ""
    echo "Option 4: Create a .env file"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your AWS credentials"
    echo "  source .env"
    echo ""
    echo -e "${BLUE}For more details, see: CREDENTIAL_SETUP_GUIDE.md${NC}"
    exit 1
fi