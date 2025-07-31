#!/usr/bin/env python3
"""
Part 4: Infrastructure as Code & Data Pipeline with AWS CDK
Main CDK Application

This application deploys the complete Rearc Data Quest pipeline infrastructure:
- Lambda functions for data processing
- SQS queue for event-driven analytics
- S3 bucket notifications
- CloudWatch events for scheduling
- IAM roles and permissions
"""

import os
import aws_cdk as cdk
from pipeline_stack import DataQuestPipelineStackV2

app = cdk.App()

# Environment configuration
env = cdk.Environment(
    account=os.getenv('CDK_DEFAULT_ACCOUNT'),
    region=os.getenv('CDK_DEFAULT_REGION', 'us-east-1')
)

# Deploy the main pipeline stack
pipeline_stack = DataQuestPipelineStackV2(
    app, 
    "DataQuestPipelineV2",
    env=env,
    description="Data Quest V2 - Complete Data Pipeline Infrastructure"
)

# Add tags to all resources
cdk.Tags.of(app).add("Project", "Data-Quest-V2")
cdk.Tags.of(app).add("Environment", "Production")
cdk.Tags.of(app).add("Owner", "Data-Engineering-Team")

app.synth()