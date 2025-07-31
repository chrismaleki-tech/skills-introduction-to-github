#!/bin/bash

# CloudFormation Stack Recovery Script
# Handles UPDATE_ROLLBACK_FAILED state for Rearc Data Quest Pipeline

set -e

STACK_NAME=${1:-"DataQuestPipelineV2"}
AWS_REGION=${AWS_DEFAULT_REGION:-"us-east-1"}

echo "🔧 CloudFormation Stack Recovery"
echo "================================="
echo "Stack: $STACK_NAME"
echo "Region: $AWS_REGION"
echo ""

# Function to check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo "❌ AWS credentials not configured!"
        echo "Please run: aws configure"
        echo "Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables"
        exit 1
    fi
    echo "✅ AWS credentials configured"
}

# Function to get current stack status
get_stack_status() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "DOES_NOT_EXIST"
}

# Function to continue rollback with skipped resources
continue_rollback_skip() {
    echo "🔄 Attempting to continue rollback, skipping Lambda functions..."
    
    # The specific resource IDs from your error message
    aws cloudformation continue-update-rollback \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --resources-to-skip "AnalyticsProcessorFunctionF4B01001" "DataProcessorFunctionAD472B9A"
    
    if [ $? -eq 0 ]; then
        echo "✅ Continue rollback initiated successfully"
        echo "⏳ Waiting for rollback to complete..."
        
        # Wait for rollback to complete
        aws cloudformation wait stack-rollback-complete \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION"
        
        if [ $? -eq 0 ]; then
            echo "🎉 Stack rollback completed successfully!"
            return 0
        else
            echo "⚠️  Rollback wait timed out or failed"
            return 1
        fi
    else
        echo "❌ Failed to initiate rollback"
        return 1
    fi
}

# Function to manually delete Lambda functions
delete_lambda_functions() {
    echo ""
    echo "🗑️  Attempting to delete Lambda functions manually..."
    
    # Delete the stuck Lambda functions
    aws lambda delete-function \
        --function-name "data-quest-v2-data-processor" \
        --region "$AWS_REGION" 2>/dev/null && echo "✅ Deleted data-processor function" || echo "⚠️  Could not delete data-processor (may not exist)"
    
    aws lambda delete-function \
        --function-name "data-quest-v2-analytics-processor" \
        --region "$AWS_REGION" 2>/dev/null && echo "✅ Deleted analytics-processor function" || echo "⚠️  Could not delete analytics-processor (may not exist)"
}

# Function to retry simple rollback
retry_rollback() {
    echo "🔄 Retrying simple rollback..."
    aws cloudformation continue-update-rollback \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION"
}

# Function to delete entire stack if all else fails
delete_stack() {
    echo ""
    echo "⚠️  LAST RESORT: Deleting entire stack"
    echo "You will need to redeploy with 'cdk deploy' after this"
    echo ""
    read -p "Are you sure you want to delete the entire stack? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        aws cloudformation delete-stack \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION"
        echo "🗑️  Stack deletion initiated"
        echo "⏳ Waiting for deletion to complete..."
        aws cloudformation wait stack-delete-complete \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION"
        echo "✅ Stack deleted successfully"
        echo "📝 You can now run 'cdk deploy' to recreate the stack"
    else
        echo "❌ Stack deletion cancelled"
    fi
}

# Main recovery logic
main() {
    # Check AWS configuration
    check_aws_config
    
    # Get current stack status
    STATUS=$(get_stack_status)
    echo "📊 Current stack status: $STATUS"
    echo ""
    
    case "$STATUS" in
        "UPDATE_ROLLBACK_FAILED")
            echo "🎯 Stack is in UPDATE_ROLLBACK_FAILED state"
            
            # Try to continue rollback with skipped resources
            if continue_rollback_skip; then
                echo "🎉 Recovery successful!"
                exit 0
            fi
            
            echo ""
            echo "⚠️  Rollback with skip failed. Trying manual cleanup..."
            
            # Try manual Lambda deletion + simple rollback
            delete_lambda_functions
            sleep 5
            
            if retry_rollback; then
                echo "🎉 Recovery successful after manual cleanup!"
                exit 0
            fi
            
            echo ""
            echo "❌ All automatic recovery attempts failed"
            echo "You may need to delete the entire stack and redeploy"
            delete_stack
            ;;
            
        "UPDATE_IN_PROGRESS")
            echo "⏹️  Stack update in progress, cancelling..."
            aws cloudformation cancel-update-stack \
                --stack-name "$STACK_NAME" \
                --region "$AWS_REGION"
            echo "✅ Update cancelled"
            ;;
            
        "UPDATE_COMPLETE"|"CREATE_COMPLETE")
            echo "✅ Stack is already in a stable state"
            ;;
            
        "DOES_NOT_EXIST")
            echo "❌ Stack does not exist"
            echo "You can run 'cdk deploy' to create it"
            ;;
            
        *)
            echo "⚠️  Unexpected stack status: $STATUS"
            echo "Please check the AWS CloudFormation console for more details"
            echo "Console URL: https://$AWS_REGION.console.aws.amazon.com/cloudformation/home?region=$AWS_REGION#/stacks"
            ;;
    esac
}

# Run main function
main "$@"