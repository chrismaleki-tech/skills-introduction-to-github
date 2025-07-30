# CDK Deployment Error Fix Instructions

## Current Error
Your CloudFormation stack `RearcDataQuestPipeline` is stuck in `UPDATE_IN_PROGRESS` state and cannot be updated.

## Prerequisites
Ensure you have AWS credentials configured:
```bash
aws configure
# or export AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
```

## Solution Options (Try in order)

### Option 1: Cancel Current Update (Recommended First Step)
```bash
cd /workspace/part4_infrastructure/cdk
source venv/bin/activate

# Try to cancel the current update
aws cloudformation cancel-update-stack --stack-name RearcDataQuestPipeline

# Wait for cancellation to complete
aws cloudformation wait stack-update-rollback-complete --stack-name RearcDataQuestPipeline
```

### Option 2: Use the Automated Recovery Script
```bash
# Make sure the script is executable
chmod +x fix_stack.sh

# Run the automated recovery script
./fix_stack.sh
```

### Option 3: Manual Recovery Steps
```bash
# Check current stack status
aws cloudformation describe-stacks --stack-name RearcDataQuestPipeline --query 'Stacks[0].StackStatus'

# If stack is in UPDATE_ROLLBACK_FAILED, continue rollback
aws cloudformation continue-update-rollback --stack-name RearcDataQuestPipeline

# Wait for completion
aws cloudformation wait stack-update-rollback-complete --stack-name RearcDataQuestPipeline
```

### Option 4: Delete and Recreate Stack (Last Resort)
```bash
# Delete the entire stack
aws cloudformation delete-stack --stack-name RearcDataQuestPipeline

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete --stack-name RearcDataQuestPipeline

# Deploy again
source venv/bin/activate
cdk deploy
```

### Option 5: Use CDK to Retry
```bash
source venv/bin/activate

# Try CDK deploy with force flag
cdk deploy --force

# Or try with no-rollback to skip rollback on failure
cdk deploy --no-rollback
```

## After Stack is Fixed
Once the stack is back to a stable state (CREATE_COMPLETE, UPDATE_COMPLETE, or UPDATE_ROLLBACK_COMPLETE), you can retry your deployment:

```bash
source venv/bin/activate
cdk deploy
```

## Notes
- The Node.js version warning can be ignored for now - it's just a notice
- The UPDATE_IN_PROGRESS error is common when a previous deployment was interrupted
- Always wait for operations to complete before trying the next step
- If you encounter permission errors, ensure your AWS credentials have CloudFormation and Lambda permissions

## Troubleshooting
If none of these work:
1. Check the CloudFormation console for detailed error messages
2. Look at CloudWatch logs for any Lambda function errors
3. Ensure you have the necessary AWS permissions
4. Contact AWS support if the issue persists