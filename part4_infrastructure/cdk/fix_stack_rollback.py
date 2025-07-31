#!/usr/bin/env python3
"""
CloudFormation Stack Recovery Script for UPDATE_ROLLBACK_FAILED state

This script helps recover from a CloudFormation stack that's stuck in 
UPDATE_ROLLBACK_FAILED state by properly handling stuck resources.

Usage:
    python fix_stack_rollback.py [stack-name]
    
If no stack name is provided, it will attempt to detect the CDK stack.
"""

import boto3
import json
import sys
import time
from botocore.exceptions import ClientError

def get_cloudformation_client():
    """Initialize CloudFormation client."""
    return boto3.client('cloudformation')

def get_stack_name():
    """Get stack name from CDK or command line."""
    if len(sys.argv) > 1:
        return sys.argv[1]
    
    # Try to detect from CDK
    try:
        import subprocess
        result = subprocess.run(['cdk', 'list'], capture_output=True, text=True)
        if result.returncode == 0:
            stacks = result.stdout.strip().split('\n')
            if stacks and stacks[0]:
                return stacks[0]
    except:
        pass
    
    # Default stack name
    return "DataQuestPipelineV2"

def check_stack_status(cf_client, stack_name):
    """Check the current status of the stack."""
    try:
        response = cf_client.describe_stacks(StackName=stack_name)
        stack = response['Stacks'][0]
        return stack['StackStatus']
    except ClientError as e:
        print(f"Error checking stack status: {e}")
        return None

def get_stuck_resources(cf_client, stack_name):
    """Get list of resources that might be stuck."""
    try:
        paginator = cf_client.get_paginator('list_stack_resources')
        stuck_resources = []
        
        for page in paginator.paginate(StackName=stack_name):
            for resource in page['StackResourceSummaries']:
                # Look for resources in failed states
                if any(status in resource.get('ResourceStatus', '') for status in 
                       ['UPDATE_FAILED', 'DELETE_FAILED', 'UPDATE_ROLLBACK_FAILED']):
                    stuck_resources.append(resource['LogicalResourceId'])
        
        return stuck_resources
    except ClientError as e:
        print(f"Error getting stuck resources: {e}")
        return []

def cancel_update_stack(cf_client, stack_name):
    """Cancel stack update if it's in progress."""
    try:
        cf_client.cancel_update_stack(StackName=stack_name)
        print("✅ Stack update cancelled successfully")
        
        # Wait for cancellation to complete
        print("⏳ Waiting for cancellation to complete...")
        waiter = cf_client.get_waiter('stack_update_complete')
        waiter.wait(
            StackName=stack_name,
            WaiterConfig={'Delay': 15, 'MaxAttempts': 40}
        )
        return True
    except ClientError as e:
        if "No updates are to be performed" in str(e):
            print("ℹ️  No update in progress to cancel")
            return True
        print(f"⚠️  Error cancelling update: {e}")
        return False

def continue_rollback_with_skip(cf_client, stack_name, resources_to_skip):
    """Continue rollback by skipping problematic resources."""
    try:
        print(f"🔄 Attempting to continue rollback, skipping resources: {resources_to_skip}")
        
        cf_client.continue_update_rollback(
            StackName=stack_name,
            ResourcesToSkip=resources_to_skip
        )
        
        print("✅ Continue rollback initiated successfully")
        
        # Wait for rollback to complete
        print("⏳ Waiting for rollback to complete...")
        waiter = cf_client.get_waiter('stack_rollback_complete')
        waiter.wait(
            StackName=stack_name,
            WaiterConfig={'Delay': 30, 'MaxAttempts': 60}
        )
        
        print("✅ Stack rollback completed successfully!")
        return True
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == 'ValidationError':
            print(f"⚠️  Validation error: {e}")
            return False
        else:
            print(f"⚠️  Error during rollback: {e}")
            return False

def delete_stuck_resources_manually(stack_name):
    """Provide instructions for manually deleting stuck Lambda functions."""
    print("\n" + "="*60)
    print("MANUAL CLEANUP REQUIRED")
    print("="*60)
    print("\nThe Lambda functions appear to be stuck. Try these manual steps:")
    print("\n1. Delete Lambda functions manually:")
    print("   aws lambda delete-function --function-name data-quest-v2-data-processor")
    print("   aws lambda delete-function --function-name data-quest-v2-analytics-processor")
    
    print("\n2. Then retry the rollback:")
    print(f"   aws cloudformation continue-update-rollback --stack-name {stack_name}")
    
    print("\n3. If that fails, you may need to delete the entire stack:")
    print(f"   aws cloudformation delete-stack --stack-name {stack_name}")
    print("   cdk deploy  # To redeploy from scratch")

def main():
    """Main recovery process."""
    print("🔧 CloudFormation Stack Recovery Tool")
    print("="*50)
    
    # Initialize AWS client
    try:
        cf_client = get_cloudformation_client()
    except Exception as e:
        print(f"❌ Error initializing AWS client: {e}")
        print("Please ensure AWS credentials are configured:")
        print("  aws configure")
        print("  # OR set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables")
        return 1
    
    # Get stack name
    stack_name = get_stack_name()
    print(f"🎯 Working with stack: {stack_name}")
    
    # Check current status
    status = check_stack_status(cf_client, stack_name)
    if not status:
        print("❌ Could not determine stack status")
        return 1
    
    print(f"📊 Current stack status: {status}")
    
    # Handle different scenarios based on stack status
    if status == "UPDATE_ROLLBACK_FAILED":
        print("\n🔄 Stack is in UPDATE_ROLLBACK_FAILED state")
        
        # Get stuck resources
        stuck_resources = get_stuck_resources(cf_client, stack_name)
        print(f"🔍 Found potentially stuck resources: {stuck_resources}")
        
        # Known problematic resources from your error
        lambda_resources = [
            "AnalyticsProcessorFunctionF4B01001",
            "DataProcessorFunctionAD472B9A"
        ]
        
        # Try to continue rollback with skipping Lambda functions
        if continue_rollback_with_skip(cf_client, stack_name, lambda_resources):
            print("🎉 Stack recovery completed successfully!")
            return 0
        else:
            delete_stuck_resources_manually(stack_name)
            return 1
            
    elif status == "UPDATE_IN_PROGRESS":
        print("\n⏹️  Stack update in progress, cancelling...")
        if cancel_update_stack(cf_client, stack_name):
            print("✅ Update cancelled, stack should now be stable")
            return 0
        else:
            print("❌ Failed to cancel update")
            return 1
            
    elif status in ["UPDATE_COMPLETE", "CREATE_COMPLETE"]:
        print("✅ Stack is already in a stable state")
        return 0
        
    else:
        print(f"⚠️  Unexpected stack status: {status}")
        print("Please check the AWS CloudFormation console for more details")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)