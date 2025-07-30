#!/bin/bash

# Part 1 S3 Permissions Fix Script
# This script helps fix S3 permissions required for Part 1 BLS data sync

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Part 1 S3 Permissions Fix ===${NC}"
echo "This script will help you set up the required S3 permissions for Part 1 BLS data sync"
echo

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}AWS CLI not found. Installing...${NC}"
    
    # Detect OS and install AWS CLI
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt update
        sudo apt install -y awscli
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install awscli
    else
        echo -e "${RED}Please install AWS CLI manually: https://aws.amazon.com/cli/${NC}"
        exit 1
    fi
fi

# Check AWS credentials
echo -e "${YELLOW}Step 1: Checking AWS credentials...${NC}"
if aws sts get-caller-identity &> /dev/null; then
    CALLER_IDENTITY=$(aws sts get-caller-identity)
    USER_ARN=$(echo $CALLER_IDENTITY | grep -o '"Arn": "[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ AWS credentials configured${NC}"
    echo "Current identity: $USER_ARN"
else
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Please configure your AWS credentials first:"
    echo "  aws configure"
    echo "Or set environment variables:"
    echo "  export AWS_ACCESS_KEY_ID=your_access_key"
    echo "  export AWS_SECRET_ACCESS_KEY=your_secret_key"
    echo "  export AWS_DEFAULT_REGION=us-east-1"
    exit 1
fi

# Extract username from ARN
if [[ $USER_ARN == *":user/"* ]]; then
    USERNAME=$(echo $USER_ARN | sed 's/.*:user\///')
    echo "IAM User: $USERNAME"
    
    echo
    echo -e "${YELLOW}Step 2: Applying Part 1 S3 permissions...${NC}"
    
    # Create the IAM policy
    POLICY_NAME="Part1BLSDataSyncS3Policy"
    POLICY_FILE="aws/iam-policy-part1-s3.json"
    
    if [ ! -f "$POLICY_FILE" ]; then
        echo -e "${RED}❌ Policy file not found: $POLICY_FILE${NC}"
        exit 1
    fi
    
    echo "Creating IAM policy: $POLICY_NAME"
    
    # Try to create the policy (will fail if it already exists)
    POLICY_ARN=""
    if aws iam create-policy --policy-name "$POLICY_NAME" --policy-document file://"$POLICY_FILE" &> /dev/null; then
        echo -e "${GREEN}✅ Created new IAM policy${NC}"
        ACCOUNT_ID=$(echo $CALLER_IDENTITY | grep -o '"Account": "[^"]*"' | cut -d'"' -f4)
        POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
    else
        echo -e "${YELLOW}⚠️  Policy already exists, getting ARN...${NC}"
        ACCOUNT_ID=$(echo $CALLER_IDENTITY | grep -o '"Account": "[^"]*"' | cut -d'"' -f4)
        POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
        
        # Update the policy with the latest version
        echo "Updating policy with latest version..."
        aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document file://"$POLICY_FILE" --set-as-default
    fi
    
    # Attach policy to user
    echo "Attaching policy to user: $USERNAME"
    if aws iam attach-user-policy --user-name "$USERNAME" --policy-arn "$POLICY_ARN"; then
        echo -e "${GREEN}✅ Successfully attached S3 policy to user${NC}"
    else
        echo -e "${YELLOW}⚠️  Policy may already be attached${NC}"
    fi
    
    echo
    echo -e "${YELLOW}Step 3: Testing S3 permissions...${NC}"
    
    # Test S3 access
    BUCKET_NAME="rearc-quest-bls-data"
    
    # Test bucket creation/access
    if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
        echo -e "${GREEN}✅ Can access bucket: $BUCKET_NAME${NC}"
    elif aws s3 mb "s3://$BUCKET_NAME" 2>/dev/null; then
        echo -e "${GREEN}✅ Created bucket: $BUCKET_NAME${NC}"
    else
        echo -e "${RED}❌ Cannot create or access bucket: $BUCKET_NAME${NC}"
        echo "This may indicate insufficient permissions or the bucket exists in another account"
    fi
    
    # Test object operations
    TEST_FILE="/tmp/test-s3-permissions.txt"
    echo "Test file for S3 permissions" > "$TEST_FILE"
    
    if aws s3 cp "$TEST_FILE" "s3://$BUCKET_NAME/test/permissions-test.txt" 2>/dev/null; then
        echo -e "${GREEN}✅ Can upload objects to S3${NC}"
        # Clean up test file
        aws s3 rm "s3://$BUCKET_NAME/test/permissions-test.txt" 2>/dev/null
    else
        echo -e "${RED}❌ Cannot upload objects to S3${NC}"
    fi
    
    rm -f "$TEST_FILE"
    
    echo
    echo -e "${GREEN}=== Part 1 S3 Permissions Setup Complete ===${NC}"
    echo "You can now run Part 1 BLS data sync:"
    echo "  cd part1_data_sourcing"
    echo "  python3 bls_data_sync.py"
    
else
    echo -e "${YELLOW}⚠️  You are using an IAM role instead of an IAM user${NC}"
    echo "For IAM roles, you need to:"
    echo "1. Attach the S3 permissions policy to the role"
    echo "2. Or ensure the role has AmazonS3FullAccess policy"
    echo
    echo "Manual steps:"
    echo "1. Go to AWS Console → IAM → Roles"
    echo "2. Find your role and attach this policy:"
    echo "   Policy JSON available in: aws/iam-policy-part1-s3.json"
fi

echo
echo -e "${BLUE}=== Required S3 Permissions Summary ===${NC}"
echo "The following permissions were configured:"
echo "  • s3:CreateBucket (create BLS data bucket)"
echo "  • s3:HeadBucket (check bucket existence)"
echo "  • s3:PutObject (upload BLS data files)"
echo "  • s3:HeadObject (check object existence/etag)"
echo "  • s3:GetObjectVersion (version management)"
echo "  • s3:ListBucket (list bucket contents)"
echo "  • s3:GetBucketLocation (bucket region info)"
echo "  • sts:GetCallerIdentity (credential validation)"
echo
echo "Target bucket: rearc-quest-bls-data"