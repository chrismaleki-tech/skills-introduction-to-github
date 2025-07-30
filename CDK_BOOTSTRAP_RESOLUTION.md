# CDK Bootstrap Resolution Guide

## Issue Summary

You encountered the following error:
```
RearcDataQuestPipeline: SSM parameter /cdk-bootstrap/hnb659fds/version not found. 
Has the environment been bootstrapped? Please run 'cdk bootstrap'
```

This error occurs because your AWS environment hasn't been bootstrapped for CDK deployments. The CDK requires a one-time setup process called "bootstrapping" that creates the necessary AWS resources.

## Root Cause

The CDK bootstrap process creates essential AWS resources including:
- S3 bucket for storing deployment artifacts
- IAM roles for CDK operations
- SSM parameters for version tracking
- CloudFormation execution role

Without these resources, CDK cannot deploy your infrastructure.

## Resolution Status

✅ **Environment Setup Complete**
- AWS CLI installed and configured
- Node.js (v22.16.0) and npm (10.9.2) installed
- AWS CDK (2.1023.0) installed globally
- Python virtual environment created
- All project dependencies installed

❌ **Missing: AWS Credentials**
- AWS credentials need to be configured before CDK bootstrap can run

## Resolution Steps

### Step 1: Configure AWS Credentials

Choose **ONE** of these methods:

#### Method A: AWS CLI Configuration (Recommended)
```bash
aws configure
```
When prompted, enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (suggest: us-east-2)
- Default output format (suggest: json)

#### Method B: Environment Variables
```bash
export AWS_ACCESS_KEY_ID='your-access-key-id'
export AWS_SECRET_ACCESS_KEY='your-secret-access-key'
export AWS_DEFAULT_REGION='us-east-2'
```

#### Method C: Use Project Setup Script
```bash
./setup_credentials.sh
```

#### Method D: Create .env File
```bash
cp .env.example .env
# Edit .env file with your AWS credentials
source .env
```

### Step 2: Run CDK Bootstrap

Once credentials are configured, run the automated fix script:

```bash
./fix_cdk_bootstrap.sh
```

Or manually bootstrap:

```bash
cd part4_infrastructure/cdk
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-2
cdk bootstrap "aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION"
```

### Step 3: Verify and Deploy

After successful bootstrap:

```bash
cd part4_infrastructure/cdk
cdk synth  # Verify synthesis works
cdk deploy # Deploy your infrastructure
```

## Troubleshooting

### Common Issues

1. **Invalid Credentials**
   ```
   Error: Unable to locate credentials
   ```
   Solution: Verify your AWS credentials are correct and have sufficient permissions.

2. **Permission Denied**
   ```
   Error: User is not authorized to perform: sts:GetCallerIdentity
   ```
   Solution: Ensure your AWS user has the necessary IAM permissions for CDK operations.

3. **Region Mismatch**
   ```
   Error: The security token included in the request is invalid
   ```
   Solution: Ensure your AWS region is set correctly and matches your account setup.

### Required AWS Permissions

Your AWS user needs these minimum permissions:
- `sts:GetCallerIdentity`
- `cloudformation:*`
- `s3:*`
- `iam:*`
- `ssm:*`
- `lambda:*` (for your specific stack)

## Files Created/Modified

- ✅ `fix_cdk_bootstrap.sh` - Automated resolution script
- ✅ All required dependencies installed
- ✅ Python virtual environment set up
- ✅ CDK environment prepared

## Next Steps

1. Configure AWS credentials using one of the methods above
2. Run `./fix_cdk_bootstrap.sh` to complete the bootstrap process
3. Deploy your CDK stack with `cdk deploy`

## Additional Resources

- [AWS CDK Bootstrapping Guide](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html)
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
- Project documentation: `CREDENTIAL_SETUP_GUIDE.md`

## Support

If you continue to experience issues:
1. Verify your AWS account is active and has billing configured
2. Check that your AWS user has the required permissions
3. Ensure you're using the correct AWS region
4. Review the CDK documentation for additional troubleshooting steps