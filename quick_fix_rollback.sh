#!/bin/bash

# Quick fix for UPDATE_ROLLBACK_FAILED state
# This script attempts the most common recovery method

set -e

STACK_NAME="RearcDataQuestPipeline"
REGION="${AWS_DEFAULT_REGION:-us-east-2}"

echo "🚀 Quick CloudFormation Rollback Recovery"
echo "========================================="
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo ""

# Check current status
echo "📊 Checking current stack status..."
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "STACK_NOT_FOUND")

echo "Current status: $STACK_STATUS"

if [ "$STACK_STATUS" = "UPDATE_ROLLBACK_FAILED" ]; then
    echo ""
    echo "🔄 Attempting to continue rollback (most common fix)..."
    
    if aws cloudformation continue-update-rollback --stack-name "$STACK_NAME" --region "$REGION"; then
        echo "✅ Continue rollback initiated successfully!"
        echo ""
        echo "⏳ Waiting for rollback to complete (this may take several minutes)..."
        
        if aws cloudformation wait stack-update-rollback-complete --stack-name "$STACK_NAME" --region "$REGION"; then
            echo "✅ Rollback completed successfully!"
            echo ""
            echo "🎉 Your stack is now ready for redeployment!"
            echo "   You can now re-run your GitHub Actions workflow."
        else
            echo "⚠️  Rollback is taking longer than expected or failed."
            echo "   Check the AWS Console for more details."
            echo "   You may need to use the advanced recovery options in fix_stack_rollback_failed.sh"
        fi
    else
        echo "❌ Continue rollback failed."
        echo "   This may require skipping stuck resources."
        echo "   Run ./fix_stack_rollback_failed.sh for advanced options."
        exit 1
    fi
elif [ "$STACK_STATUS" = "UPDATE_ROLLBACK_COMPLETE" ] || [ "$STACK_STATUS" = "CREATE_COMPLETE" ]; then
    echo "✅ Stack is already in a good state!"
    echo "   You can proceed with your deployment."
elif [ "$STACK_STATUS" = "STACK_NOT_FOUND" ]; then
    echo "ℹ️  Stack not found. You can proceed with a fresh deployment."
else
    echo "ℹ️  Stack is in $STACK_STATUS state."
    echo "   This may not require immediate action."
fi

echo ""
echo "🔗 View in AWS Console:"
echo "   https://${REGION}.console.aws.amazon.com/cloudformation/home?region=${REGION}#/stacks/stackinfo?stackId=${STACK_NAME}"