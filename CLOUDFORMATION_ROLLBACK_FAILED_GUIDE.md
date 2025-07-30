# CloudFormation UPDATE_ROLLBACK_FAILED Recovery Guide

## Problem Description

Your CloudFormation stack `RearcDataQuestPipeline` is in an `UPDATE_ROLLBACK_FAILED` state. This occurs when:

1. A stack update fails
2. CloudFormation attempts to rollback the changes
3. The rollback operation also fails, leaving the stack in an inconsistent state
4. The stack cannot be updated until the rollback issue is resolved

## Error Details

```
❌ RearcDataQuestPipeline failed: ValidationError: Stack:arn:aws:cloudformation:***:944355516553:stack/RearcDataQuestPipeline/4523cec0-6cf4-11f0-82c0-022df240377b is in UPDATE_ROLLBACK_FAILED state and can not be updated.
```

## Immediate Solutions

### Option 1: Automatic Recovery (Recommended)

The GitHub Actions workflow has been updated to automatically handle this situation. Simply **re-run the failed GitHub Actions workflow** and it will:

1. Detect the `UPDATE_ROLLBACK_FAILED` state
2. Attempt to continue the rollback automatically
3. Handle stuck resources by skipping them if necessary
4. Proceed with the deployment once the stack is in a stable state

### Option 2: Manual Recovery Using the Recovery Script

Run the provided recovery script:

```bash
# Make the script executable
chmod +x fix_stack_rollback_failed.sh

# Run the recovery script
./fix_stack_rollback_failed.sh
```

The script provides several recovery options:
1. **Continue rollback** (recommended first attempt)
2. **Cancel rollback** and manually fix resources
3. **Skip failed resources** during rollback
4. **Delete and recreate** the stack
5. **Check stack drift**

### Option 3: Manual AWS CLI Commands

If you prefer to handle this manually:

#### Step 1: Continue Rollback
```bash
aws cloudformation continue-update-rollback --stack-name RearcDataQuestPipeline --region us-east-2
```

#### Step 2: If Step 1 Fails, Skip Failed Resources
```bash
# Get the list of failed resources
aws cloudformation describe-stack-resources \
  --stack-name RearcDataQuestPipeline \
  --region us-east-2 \
  --query 'StackResources[?ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`DELETE_FAILED`].LogicalResourceId' \
  --output text

# Continue rollback while skipping the failed resources
aws cloudformation continue-update-rollback \
  --stack-name RearcDataQuestPipeline \
  --region us-east-2 \
  --resources-to-skip <resource-id-1> <resource-id-2>
```

#### Step 3: Monitor Progress
```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name RearcDataQuestPipeline \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'

# Wait for rollback to complete
aws cloudformation wait stack-update-rollback-complete \
  --stack-name RearcDataQuestPipeline \
  --region us-east-2
```

## Prevention Strategies

### 1. Improved Error Handling

The updated GitHub Actions workflow now includes:
- Pre-deployment stack status checks
- Automatic rollback recovery
- Better error reporting
- Timeout handling

### 2. Resource Dependencies

Common causes of rollback failures:
- **Lambda functions** with external dependencies
- **IAM roles** with policies that can't be deleted
- **S3 buckets** that aren't empty
- **Security groups** with active network interfaces

### 3. Deployment Best Practices

```yaml
# Enhanced deployment step in GitHub Actions
- name: Deploy with Enhanced Error Handling
  run: |
    cd part4_infrastructure/cdk
    
    # Check and fix stack state before deployment
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name RearcDataQuestPipeline --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "STACK_NOT_FOUND")
    
    if [ "$STACK_STATUS" = "UPDATE_ROLLBACK_FAILED" ]; then
      echo "Recovering from rollback failed state..."
      aws cloudformation continue-update-rollback --stack-name RearcDataQuestPipeline
      aws cloudformation wait stack-update-rollback-complete --stack-name RearcDataQuestPipeline
    fi
    
    # Deploy with better error handling
    cdk deploy --require-approval never --verbose --rollback true
  timeout-minutes: 30
```

## Troubleshooting Common Scenarios

### Scenario 1: Lambda Function Update Fails
```bash
# If Lambda function is stuck, manually delete the function
aws lambda delete-function --function-name <function-name> --region us-east-2

# Then continue rollback
aws cloudformation continue-update-rollback --stack-name RearcDataQuestPipeline --region us-east-2
```

### Scenario 2: S3 Bucket Can't Be Deleted
```bash
# Empty the bucket first
aws s3 rm s3://bucket-name --recursive --region us-east-2

# Then continue rollback
aws cloudformation continue-update-rollback --stack-name RearcDataQuestPipeline --region us-east-2
```

### Scenario 3: IAM Role Deletion Fails
```bash
# Detach policies manually
aws iam list-attached-role-policies --role-name <role-name>
aws iam detach-role-policy --role-name <role-name> --policy-arn <policy-arn>

# Then continue rollback
aws cloudformation continue-update-rollback --stack-name RearcDataQuestPipeline --region us-east-2
```

## Monitoring and Verification

### Check Stack Status
```bash
aws cloudformation describe-stacks \
  --stack-name RearcDataQuestPipeline \
  --region us-east-2 \
  --query 'Stacks[0].{Status:StackStatus,Reason:StatusReason}' \
  --output table
```

### View Stack Events
```bash
aws cloudformation describe-stack-events \
  --stack-name RearcDataQuestPipeline \
  --region us-east-2 \
  --query 'StackEvents[0:10].{Time:Timestamp,Status:ResourceStatus,Resource:LogicalResourceId,Reason:ResourceStatusReason}' \
  --output table
```

### AWS Console Links
- **CloudFormation Console**: https://us-east-2.console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks
- **Specific Stack**: https://us-east-2.console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/stackinfo?stackId=RearcDataQuestPipeline

## Next Steps After Recovery

1. **Wait for Stable State**: Ensure the stack is in `UPDATE_ROLLBACK_COMPLETE` or `CREATE_COMPLETE` state
2. **Re-run Deployment**: Trigger the GitHub Actions workflow again
3. **Monitor Deployment**: Watch the deployment process for any new issues
4. **Verify Resources**: Confirm all expected resources are created correctly

## Emergency Contact

If all recovery options fail:
1. Create a GitHub issue with the full error details
2. Include the output of `aws cloudformation describe-stack-events`
3. Consider deleting the stack entirely and redeploying fresh (last resort)

---

**Remember**: The `UPDATE_ROLLBACK_FAILED` state is recoverable. The automatic recovery in the GitHub Actions workflow should handle most cases, but manual intervention is sometimes required for complex resource dependencies.