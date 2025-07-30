# CDK Deployment Error Solution Guide

## Error Summary

Your CDK deployment failed with the following main issues:

1. **CDK Environment Not Bootstrapped**: `SSM parameter /cdk-bootstrap/hnb659fds/version not found`
2. **IAM Permission Issues**: User `chirsm` cannot assume CDK bootstrap roles
3. **Node.js Version Warning**: Node 18 is approaching end-of-life (minor issue)

## Root Cause Analysis

### 1. Missing CDK Bootstrap
The error `SSM parameter /cdk-bootstrap/hnb659fds/version not found` indicates that the CDK environment has not been bootstrapped in your AWS account/region. CDK bootstrap creates the necessary infrastructure (S3 bucket, IAM roles, etc.) that CDK needs to deploy stacks.

### 2. IAM Permission Issues
The user `chirsm` cannot assume the CDK bootstrap roles:
```
User: arn:aws:iam::944355516553:user/chirsm is not authorized to perform: sts:AssumeRole
```

This suggests the IAM user lacks the necessary permissions for CDK operations.

## Solution Options

### Option 1: Quick Fix Script (Recommended)

Run the automated fix script:

```bash
chmod +x fix_cdk_deployment_error.sh
./fix_cdk_deployment_error.sh
```

This script will:
- Install missing prerequisites (AWS CLI, CDK CLI, Node.js)
- Verify AWS credentials
- Attempt CDK bootstrap with proper error handling
- Provide detailed troubleshooting guidance if bootstrap fails

### Option 2: Manual Bootstrap Process

1. **Ensure AWS CLI and CDK are installed:**
   ```bash
   # Install AWS CLI (if not installed)
   sudo apt update && sudo apt install -y awscli
   
   # Install Node.js 20 LTS
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install CDK CLI
   npm install -g aws-cdk@latest
   ```

2. **Configure AWS credentials:**
   ```bash
   # Option A: Environment variables (for GitHub Actions)
   export AWS_ACCESS_KEY_ID='your-access-key'
   export AWS_SECRET_ACCESS_KEY='your-secret-key'
   export AWS_DEFAULT_REGION='your-region'
   
   # Option B: AWS CLI configuration
   aws configure
   ```

3. **Bootstrap CDK:**
   ```bash
   cd part4_infrastructure/cdk
   
   # Get your account ID and region
   ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   REGION=${AWS_DEFAULT_REGION:-us-east-1}
   
   # Bootstrap CDK
   cdk bootstrap aws://$ACCOUNT_ID/$REGION
   ```

### Option 3: Fix IAM Permissions

The user `chirsm` needs these IAM permissions for CDK bootstrap:

#### Required IAM Policies:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:*",
                "s3:*",
                "iam:*",
                "ssm:*",
                "ecr:*",
                "sts:AssumeRole"
            ],
            "Resource": "*"
        }
    ]
}
```

#### AWS Managed Policies (Easier):
Attach these AWS managed policies to the user:
- `arn:aws:iam::aws:policy/AWSCloudFormationFullAccess`
- `arn:aws:iam::aws:policy/IAMFullAccess`
- `arn:aws:iam::aws:policy/AmazonS3FullAccess`
- `arn:aws:iam::aws:policy/AmazonSSMFullAccess`
- `arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess`

## GitHub Actions Configuration

For GitHub Actions, ensure these secrets are configured:

```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_DEFAULT_REGION: ${{ secrets.AWS_DEFAULT_REGION }}
```

## Updated GitHub Actions Workflow

Here's an improved workflow section for your CDK deployment:

```yaml
- name: Bootstrap CDK (if needed)
  run: |
    cd part4_infrastructure/cdk
    
    # Check if bootstrap is needed
    if ! aws ssm get-parameter --name "/cdk-bootstrap/hnb659fds/version" --region $AWS_DEFAULT_REGION 2>/dev/null; then
      echo "CDK environment not bootstrapped. Bootstrapping..."
      ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
      cdk bootstrap aws://$ACCOUNT_ID/$AWS_DEFAULT_REGION
    else
      echo "CDK environment already bootstrapped"
    fi

- name: Deploy CDK Stack
  run: |
    cd part4_infrastructure/cdk
    cdk deploy --require-approval never --verbose
```

## Verification Steps

After fixing the bootstrap issue:

1. **Verify bootstrap:**
   ```bash
   aws ssm get-parameter --name "/cdk-bootstrap/hnb659fds/version" --region $AWS_DEFAULT_REGION
   ```

2. **Test CDK deployment:**
   ```bash
   cd part4_infrastructure/cdk
   cdk deploy --require-approval never
   ```

## Additional Troubleshooting

### If Bootstrap Still Fails

1. **Check AWS credentials:**
   ```bash
   aws sts get-caller-identity
   ```

2. **Verify IAM permissions:**
   ```bash
   aws iam simulate-principal-policy \
     --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
     --action-names cloudformation:CreateStack \
     --resource-arns "*"
   ```

3. **Check region configuration:**
   ```bash
   echo $AWS_DEFAULT_REGION
   aws configure get region
   ```

### Common Issues

1. **Region Mismatch**: Ensure your region is consistent across AWS CLI config and environment variables
2. **Account Permissions**: In organizations, you may need administrative assistance
3. **Resource Limits**: Check if you've hit AWS service limits
4. **Existing Resources**: Conflicts with existing CloudFormation stacks or S3 buckets

## Next Steps

Once CDK bootstrap is successful:

1. Deploy your stack: `cdk deploy --require-approval never`
2. Monitor CloudFormation events in AWS Console
3. Check Lambda function logs if deployment succeeds but functions fail
4. Verify all resources are created as expected

## Contact Information

If you continue to have issues:
- Check the AWS CloudFormation console for detailed error messages
- Review IAM policies and permissions
- Consider using an administrator account for initial setup
- Check AWS service health and limits

## Files Modified/Created

- `fix_cdk_deployment_error.sh` - Automated fix script
- `CDK_DEPLOYMENT_ERROR_SOLUTION.md` - This solution guide

Run the fix script first, and follow the manual steps if needed.