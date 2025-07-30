# CloudFormation Stack Recovery Guide

## Issue Description
Your CloudFormation stack is stuck in `UPDATE_ROLLBACK_FAILED` state with the following stuck resources:
- `AnalyticsProcessorFunctionF4B01001` (Lambda function)
- `DataProcessorFunctionAD472B9A` (Lambda function)

This commonly happens when Lambda functions fail to update or delete due to permissions, timing issues, or resource conflicts.

## Prerequisites

1. **Configure AWS Credentials** (if not already done):
   ```bash
   aws configure
   ```
   Or set environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=us-east-1
   ```

2. **Verify credentials**:
   ```bash
   aws sts get-caller-identity
   ```

## Solution Options

### Option 1: Automated Recovery Script (Recommended)

Use the provided shell script that handles the most common recovery scenarios:

```bash
./fix_stack.sh
```

Or specify a custom stack name:
```bash
./fix_stack.sh YourStackName
```

### Option 2: Python Recovery Script

If you prefer Python or need more detailed logging:

```bash
python fix_stack_rollback.py
```

### Option 3: Manual Recovery (Step by Step)

If the automated scripts don't work, follow these manual steps:

#### Step 1: Try to continue rollback with skipped resources
```bash
aws cloudformation continue-update-rollback \
    --stack-name RearcDataQuestPipeline \
    --resources-to-skip "AnalyticsProcessorFunctionF4B01001" "DataProcessorFunctionAD472B9A"
```

#### Step 2: Wait for rollback completion
```bash
aws cloudformation wait stack-rollback-complete \
    --stack-name RearcDataQuestPipeline
```

#### Step 3: If Step 1 fails, delete Lambda functions manually
```bash
# Delete the stuck Lambda functions
aws lambda delete-function --function-name rearc-quest-data-processor
aws lambda delete-function --function-name rearc-quest-analytics-processor
```

#### Step 4: Retry rollback after manual cleanup
```bash
aws cloudformation continue-update-rollback \
    --stack-name RearcDataQuestPipeline
```

#### Step 5: Last resort - Delete entire stack
If all else fails, delete the entire stack and redeploy:

```bash
aws cloudformation delete-stack --stack-name RearcDataQuestPipeline
aws cloudformation wait stack-delete-complete --stack-name RearcDataQuestPipeline

# Then redeploy
cdk deploy
```

## Common Error Messages and Solutions

### Error: "RollbackUpdatedStack cannot be called from current stack status"
- **Solution**: The stack is not in the correct state. Wait for any ongoing operations to complete or try cancelling first.

### Error: "ValidationError"
- **Solution**: The resources you're trying to skip might not exist or have different names. Check the actual resource names in the CloudFormation console.

### Error: "AccessDenied"
- **Solution**: Your AWS credentials don't have sufficient permissions. Ensure you have `cloudformation:*` and `lambda:*` permissions.

## Verification Steps

After successful recovery, verify the stack status:

```bash
aws cloudformation describe-stacks \
    --stack-name RearcDataQuestPipeline \
    --query 'Stacks[0].StackStatus'
```

Expected result: `"UPDATE_ROLLBACK_COMPLETE"` or `"CREATE_COMPLETE"`

## Prevention for Future Deployments

To avoid similar issues in the future:

1. **Check Lambda function sizes**: Large Lambda packages can cause deployment issues
2. **Use proper IAM permissions**: Ensure CloudFormation has permissions to manage all resources
3. **Monitor resource limits**: Check AWS service limits for Lambda functions
4. **Test deployments**: Use smaller test stacks before deploying to production

## Additional Resources

- [AWS CloudFormation User Guide - Stack Update Rollback](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-monitor-stack.html)
- [AWS CLI CloudFormation Reference](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/)
- [AWS CDK Troubleshooting Guide](https://docs.aws.amazon.com/cdk/v2/guide/troubleshooting.html)

## Getting Help

If these solutions don't resolve your issue:

1. Check the CloudFormation console for detailed error messages
2. Look at CloudWatch logs for Lambda function errors  
3. Contact AWS Support if you have a support plan
4. Post on AWS forums or Stack Overflow with the specific error messages

---

**Note**: The recovery scripts are designed to be safe and will prompt before taking destructive actions like deleting the entire stack.