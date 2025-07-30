#!/bin/bash

# Fix CloudFormation Stack in UPDATE_ROLLBACK_FAILED State
# This script provides multiple options to resolve the stack issue

set -e

STACK_NAME="RearcDataQuestPipeline"
REGION="${AWS_DEFAULT_REGION:-us-east-2}"

echo "🔧 CloudFormation Stack Recovery Tool"
echo "======================================"
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured or credentials not available"
    exit 1
fi

# Function to check stack status
check_stack_status() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].{Status:StackStatus,Reason:StatusReason}' \
        --output table 2>/dev/null || echo "Stack not found"
}

# Function to get failed resources
get_failed_resources() {
    echo "🔍 Checking for failed resources..."
    aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackEvents[?ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`CREATE_FAILED` || ResourceStatus==`DELETE_FAILED`].{Resource:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason,Time:Timestamp}' \
        --output table 2>/dev/null || echo "No events found"
}

echo "📊 Current Stack Status:"
check_stack_status
echo ""

echo "🔍 Failed Resources (if any):"
get_failed_resources
echo ""

echo "Available recovery options:"
echo "1. Continue rollback (recommended first attempt)"
echo "2. Cancel rollback and manually fix resources"
echo "3. Skip failed resources during rollback"
echo "4. Delete and recreate the stack"
echo "5. Check stack drift"
echo "6. Exit"
echo ""

read -p "Choose an option (1-6): " choice

case $choice in
    1)
        echo "🔄 Attempting to continue rollback..."
        aws cloudformation continue-update-rollback \
            --stack-name "$STACK_NAME" \
            --region "$REGION" && \
        echo "✅ Continue rollback initiated. Monitor in AWS Console." || \
        echo "❌ Continue rollback failed. Try option 2 or 3."
        ;;
    
    2)
        echo "🛑 Canceling rollback..."
        aws cloudformation cancel-update-stack \
            --stack-name "$STACK_NAME" \
            --region "$REGION" && \
        echo "✅ Rollback canceled. You can now manually fix resources and retry deployment." || \
        echo "❌ Cancel rollback failed."
        ;;
    
    3)
        echo "⚠️  This will skip failed resources during rollback."
        echo "   Failed resources may remain in your account."
        read -p "Continue? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            # Get list of resources that are stuck
            echo "🔍 Identifying resources to skip..."
            RESOURCES_TO_SKIP=$(aws cloudformation describe-stack-resources \
                --stack-name "$STACK_NAME" \
                --region "$REGION" \
                --query 'StackResources[?ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`DELETE_FAILED`].LogicalResourceId' \
                --output text)
            
            if [ -n "$RESOURCES_TO_SKIP" ]; then
                echo "Resources to skip: $RESOURCES_TO_SKIP"
                aws cloudformation continue-update-rollback \
                    --stack-name "$STACK_NAME" \
                    --region "$REGION" \
                    --resources-to-skip $RESOURCES_TO_SKIP && \
                echo "✅ Rollback with skipped resources initiated." || \
                echo "❌ Failed to continue rollback with skipped resources."
            else
                echo "ℹ️  No specific failed resources found. Trying normal continue rollback..."
                aws cloudformation continue-update-rollback \
                    --stack-name "$STACK_NAME" \
                    --region "$REGION"
            fi
        fi
        ;;
    
    4)
        echo "🗑️  This will DELETE the entire stack and all its resources!"
        echo "   Make sure you have backups of any important data."
        read -p "Are you absolutely sure? Type 'DELETE' to confirm: " confirm
        if [[ $confirm == "DELETE" ]]; then
            echo "🔥 Deleting stack..."
            aws cloudformation delete-stack \
                --stack-name "$STACK_NAME" \
                --region "$REGION" && \
            echo "✅ Stack deletion initiated. Wait for completion before redeploying." || \
            echo "❌ Stack deletion failed."
        else
            echo "❌ Deletion canceled."
        fi
        ;;
    
    5)
        echo "🔍 Checking stack drift..."
        aws cloudformation detect-stack-drift \
            --stack-name "$STACK_NAME" \
            --region "$REGION" 2>/dev/null && \
        echo "✅ Drift detection initiated. Check AWS Console for results." || \
        echo "❌ Drift detection failed."
        ;;
    
    6)
        echo "👋 Exiting without changes."
        exit 0
        ;;
    
    *)
        echo "❌ Invalid option selected."
        exit 1
        ;;
esac

echo ""
echo "📊 Updated Stack Status:"
check_stack_status

echo ""
echo "📋 Next Steps:"
echo "1. Monitor the stack status in AWS Console"
echo "2. Once stack is in UPDATE_ROLLBACK_COMPLETE or CREATE_COMPLETE state, retry your deployment"
echo "3. If stack is deleted, wait for deletion to complete before redeploying"
echo ""
echo "🔗 AWS Console URL:"
echo "https://${REGION}.console.aws.amazon.com/cloudformation/home?region=${REGION}#/stacks/stackinfo?stackId=${STACK_NAME}"