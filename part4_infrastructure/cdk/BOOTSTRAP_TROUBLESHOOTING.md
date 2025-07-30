# CDK Bootstrap Permission Troubleshooting Guide

## Issue Summary
The CDK bootstrap command failed with the error:
```
User: arn:aws:iam::944355516553:user/chirsm is not authorized to perform: iam:CreateRole
```

This indicates insufficient IAM permissions to create the required roles for CDK operation.

## Root Cause
The AWS user `chirsm` has an explicit deny policy that prevents creating IAM roles, which is required for CDK bootstrap.

## Solutions

### Option 1: Use Different AWS Credentials (Recommended)

1. **Configure AWS credentials with sufficient permissions:**
   ```bash
   aws configure
   ```
   
   Or set environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=us-east-1
   ```

2. **Required IAM permissions for bootstrap:**
   - CloudFormation: Create/manage CDKToolkit stack
   - IAM: Create CDK roles (cdk-*)
   - S3: Create CDK assets bucket
   - ECR: Create CDK container repository
   - SSM: Manage CDK bootstrap parameters

3. **Clean up failed bootstrap and retry:**
   ```bash
   aws cloudformation delete-stack --stack-name CDKToolkit
   aws cloudformation wait stack-delete-complete --stack-name CDKToolkit
   cdk bootstrap
   ```

### Option 2: Request Administrator to Bootstrap

If you cannot get the required permissions:
1. Ask an AWS administrator to run `cdk bootstrap` using privileged credentials
2. Once bootstrap is complete, you only need `sts:AssumeRole` permissions for `arn:aws:iam::*:role/cdk-*`

### Option 3: Custom Bootstrap with Limited Permissions

Try using custom execution policies:
```bash
cdk bootstrap --cloudformation-execution-policies arn:aws:iam::aws:policy/PowerUserAccess
```

## After Successful Bootstrap

Once bootstrap succeeds, for regular CDK deployments you only need:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sts:AssumeRole"
            ],
            "Resource": [
                "arn:aws:iam::*:role/cdk-*"
            ]
        }
    ]
}
```

## Verification Steps

After successful bootstrap, verify:
```bash
aws sts get-caller-identity
aws cloudformation describe-stacks --stack-name CDKToolkit --query 'Stacks[0].StackStatus'
```

Expected result: `"CREATE_COMPLETE"`

## Additional Notes

- Node.js version 18.20.8 is end-of-life; consider upgrading to Node 20+ or 22+
- The `AdministratorAccess` policy used by default CDK bootstrap can be restricted using custom execution policies
- For production environments, consider using least-privilege IAM policies instead of full administrator access

## Next Steps

1. Resolve the credential issue using one of the options above
2. Successfully run `cdk bootstrap`
3. Proceed with `cdk deploy` for your application stack