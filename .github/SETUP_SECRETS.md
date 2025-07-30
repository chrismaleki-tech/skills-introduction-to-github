# GitHub Actions Setup Guide

This guide explains how to set up the required GitHub secrets for the AWS deployment workflow.

## Required Secrets

You need to add the following secrets to your GitHub repository:

### 1. Navigate to Repository Settings
1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**

### 2. Add Repository Secrets

Click **New repository secret** and add each of the following:

#### AWS Credentials
- **Name**: `AWS_ACCESS_KEY_ID`
  - **Value**: `AKIA5XX7ZUCESKTKH2TS`

- **Name**: `AWS_SECRET_ACCESS_KEY`
  - **Value**: `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`

- **Name**: `AWS_DEFAULT_REGION`
  - **Value**: `us-east-2`

#### Optional CDK Account (recommended)
- **Name**: `CDK_DEFAULT_ACCOUNT`
  - **Value**: Your AWS Account ID (get it by running `aws sts get-caller-identity`)

## Security Best Practices

⚠️ **Important Security Notes**:

1. **Never commit credentials to code** - Always use GitHub secrets
2. **Rotate credentials regularly** - Update AWS access keys periodically
3. **Use least privilege** - Ensure IAM user has only necessary permissions
4. **Monitor usage** - Check AWS CloudTrail for unexpected activity

## Required AWS IAM Permissions

Your AWS IAM user should have the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:*",
                "lambda:*",
                "sqs:*",
                "iam:*",
                "cloudformation:*",
                "events:*",
                "logs:*",
                "sts:*"
            ],
            "Resource": "*"
        }
    ]
}
```

## Environment Setup

The workflow supports multiple environments:

- **dev** (default) - Development environment
- **staging** - Staging environment  
- **prod** - Production environment

## Manual Deployment

You can manually trigger deployment by:

1. Going to **Actions** tab in your repository
2. Selecting **Deploy to AWS** workflow
3. Clicking **Run workflow**
4. Choosing the environment
5. Clicking **Run workflow** button

## Troubleshooting

### Common Issues:

1. **CDK Bootstrap Error**: Run `cdk bootstrap` manually in your AWS account
2. **Permission Denied**: Check IAM permissions
3. **Region Mismatch**: Ensure all services are in the same region
4. **Resource Conflicts**: Check for existing resources with same names

### Getting Help:

1. Check the workflow logs in GitHub Actions
2. Review AWS CloudFormation events in AWS Console
3. Check AWS CloudWatch logs for Lambda errors

## Workflow Features

The CI/CD pipeline includes:

- ✅ **Code Quality**: Linting with flake8, formatting with black
- ✅ **Security Scanning**: Bandit security scan, dependency vulnerability checks
- ✅ **Infrastructure**: AWS CDK deployment
- ✅ **Applications**: Lambda function deployment
- ✅ **Testing**: Integration tests for deployed resources
- ✅ **Reporting**: Deployment reports and artifacts
- ✅ **Cleanup**: Optional resource cleanup on failure

## Next Steps

1. Set up the GitHub secrets as described above
2. Push code to `main` branch to trigger deployment
3. Monitor the deployment in GitHub Actions
4. Check AWS Console to verify resources are created
5. Review deployment reports in Actions artifacts