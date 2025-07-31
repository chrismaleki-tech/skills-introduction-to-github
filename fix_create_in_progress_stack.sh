#!/bin/bash

# Fix CloudFormation Stack in CREATE_IN_PROGRESS State
# This script handles the common issue where a CDK stack is stuck in CREATE_IN_PROGRESS

set -e

echo "🔧 CloudFormation CREATE_IN_PROGRESS Fix"
echo "========================================"
echo ""

STACK_NAME="DataQuestPipelineV2"

# Function to check if AWS credentials are configured
check_aws_credentials() {
    echo "🔍 Checking AWS credentials..."
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo "❌ AWS credentials not configured."
        echo "Please run 'aws configure' first or set AWS environment variables:"
        echo "  export AWS_ACCESS_KEY_ID=your_access_key"
        echo "  export AWS_SECRET_ACCESS_KEY=your_secret_key"
        echo "  export AWS_DEFAULT_REGION=us-east-1"
        exit 1
    fi
    echo "✅ AWS credentials configured"
    echo ""
}

# Function to get stack status
get_stack_status() {
    local stack_name=$1
    aws cloudformation describe-stacks --stack-name "$stack_name" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "STACK_NOT_FOUND"
}

# Function to wait for stack operation to complete
wait_for_stack_completion() {
    local stack_name=$1
    local max_wait=1800  # 30 minutes
    local wait_time=0
    
    echo "⏳ Waiting for stack operation to complete..."
    
    while [ $wait_time -lt $max_wait ]; do
        local status=$(get_stack_status "$stack_name")
        echo "Current status: $status"
        
        case $status in
            "CREATE_COMPLETE"|"UPDATE_COMPLETE"|"DELETE_COMPLETE")
                echo "✅ Stack operation completed successfully"
                return 0
                ;;
            "CREATE_FAILED"|"UPDATE_FAILED"|"DELETE_FAILED"|"ROLLBACK_COMPLETE"|"ROLLBACK_FAILED"|"UPDATE_ROLLBACK_COMPLETE"|"UPDATE_ROLLBACK_FAILED")
                echo "❌ Stack operation failed with status: $status"
                return 1
                ;;
            "STACK_NOT_FOUND")
                echo "✅ Stack does not exist"
                return 0
                ;;
            "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS"|"DELETE_IN_PROGRESS"|"ROLLBACK_IN_PROGRESS"|"UPDATE_ROLLBACK_IN_PROGRESS")
                echo "⏳ Stack operation still in progress... (${wait_time}s elapsed)"
                sleep 30
                wait_time=$((wait_time + 30))
                ;;
            *)
                echo "⚠️  Unknown status: $status"
                sleep 30
                wait_time=$((wait_time + 30))
                ;;
        esac
    done
    
    echo "❌ Timeout waiting for stack operation to complete"
    return 1
}

# Function to cancel stack creation
cancel_stack_creation() {
    local stack_name=$1
    echo "🛑 Attempting to cancel stack creation..."
    
    if aws cloudformation cancel-update-stack --stack-name "$stack_name" 2>/dev/null; then
        echo "✅ Stack update cancellation initiated"
        wait_for_stack_completion "$stack_name"
    else
        echo "⚠️  Could not cancel update (stack might not be in UPDATE_IN_PROGRESS)"
        
        # Try to delete the stack if it's stuck in CREATE_IN_PROGRESS
        echo "🗑️  Attempting to delete the stuck stack..."
        if aws cloudformation delete-stack --stack-name "$stack_name"; then
            echo "✅ Stack deletion initiated"
            wait_for_stack_completion "$stack_name"
        else
            echo "❌ Failed to delete stack"
            return 1
        fi
    fi
}

# Function to get stack events for debugging
show_stack_events() {
    local stack_name=$1
    echo "📋 Recent stack events:"
    aws cloudformation describe-stack-events --stack-name "$stack_name" --max-items 10 --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]' --output table 2>/dev/null || echo "Could not retrieve stack events"
}

# Main execution
main() {
    check_aws_credentials
    
    echo "🔍 Checking status of stack: $STACK_NAME"
    local current_status=$(get_stack_status "$STACK_NAME")
    echo "Current status: $current_status"
    echo ""
    
    case $current_status in
        "CREATE_IN_PROGRESS")
            echo "🚨 Stack is stuck in CREATE_IN_PROGRESS state"
            echo ""
            echo "Options to resolve:"
            echo "1. Wait for the creation to complete (can take up to 30 minutes)"
            echo "2. Cancel/Delete the stack and retry"
            echo ""
            
            show_stack_events "$STACK_NAME"
            echo ""
            
            read -p "Do you want to wait for completion (w) or delete the stack (d)? [w/d]: " choice
            case $choice in
                "d"|"D")
                    cancel_stack_creation "$STACK_NAME"
                    ;;
                "w"|"W"|*)
                    wait_for_stack_completion "$STACK_NAME"
                    ;;
            esac
            ;;
        "UPDATE_IN_PROGRESS")
            echo "🚨 Stack is in UPDATE_IN_PROGRESS state"
            show_stack_events "$STACK_NAME"
            echo ""
            read -p "Do you want to wait for completion (w) or cancel the update (c)? [w/c]: " choice
            case $choice in
                "c"|"C")
                    cancel_stack_creation "$STACK_NAME"
                    ;;
                "w"|"W"|*)
                    wait_for_stack_completion "$STACK_NAME"
                    ;;
            esac
            ;;
        "STACK_NOT_FOUND")
            echo "✅ Stack does not exist. You can proceed with deployment."
            ;;
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            echo "✅ Stack is in a stable state. You can proceed with updates."
            ;;
        "CREATE_FAILED"|"UPDATE_FAILED"|"ROLLBACK_COMPLETE"|"ROLLBACK_FAILED")
            echo "❌ Stack is in a failed state: $current_status"
            echo "You may need to delete the stack before redeploying:"
            echo "  aws cloudformation delete-stack --stack-name $STACK_NAME"
            show_stack_events "$STACK_NAME"
            ;;
        *)
            echo "⚠️  Stack is in an unexpected state: $current_status"
            show_stack_events "$STACK_NAME"
            ;;
    esac
    
    echo ""
    echo "🎯 After resolving the stack issue, you can retry your CDK deployment:"
    echo "  cd part4_infrastructure/cdk"
    echo "  cdk deploy"
}

# Run the main function
main "$@"