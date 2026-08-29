# Rearc Data Quest - Deployment Guide

This guide provides step-by-step instructions for deploying and running the complete Rearc Data Quest solution.

## Prerequisites

### Required Software
- **Python 3.9+** - For running all scripts and notebooks
- **AWS CLI 2.x** - For AWS authentication and access
- **AWS CDK 2.x** - For infrastructure deployment
- **Node.js 16+** - Required for AWS CDK
- **Jupyter Notebook** - For running Part 3 analytics

### AWS Requirements
- **AWS Account** with appropriate permissions
- **IAM User** with the following permissions:
  - S3: Full access for bucket creation and object management
  - Lambda: Full access for function creation and execution
  - SQS: Full access for queue creation and message handling
  - CloudWatch: Logs and Events access
  - EventBridge: Rules and targets management
  - IAM: Role and policy creation

## Installation

### 1. Clone and Setup Project

```bash
# Clone the repository
git clone <repository-url>
cd rearc-data-quest

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Verify credentials
aws sts get-caller-identity
```

### 3. Install AWS CDK (if not already installed)

```bash
# Install CDK globally
npm install -g aws-cdk

# Verify installation
cdk --version

# Bootstrap CDK (one-time setup per AWS account/region)
cdk bootstrap
```

## Deployment

### Option A: Complete Infrastructure Deployment (Recommended)

Deploy the entire pipeline using AWS CDK:

```bash
cd part4_infrastructure/cdk

# Install CDK dependencies
pip install -r requirements.txt

# Deploy the stack
cdk deploy --require-approval never

# Note the outputs - you'll need the bucket names and function ARNs
```

This will create:
- S3 buckets for data storage
- Lambda functions for data processing and analytics
- SQS queue for event-driven processing
- EventBridge rule for daily scheduling
- All necessary IAM roles and permissions

### Option B: Manual Step-by-Step Deployment

If you prefer to run each part manually:

#### Part 1: BLS Data Synchronization

```bash
cd part1_data_sourcing

# Install dependencies
pip install -r requirements.txt

# Set bucket name (optional - defaults to 'rearc-quest-bls-data')
export BLS_BUCKET_NAME=your-bls-bucket-name

# Run the sync
python bls_data_sync.py
```

#### Part 2: Population Data API

```bash
cd part2_api_integration

# Install dependencies
pip install -r requirements.txt

# Set bucket name (optional - defaults to 'rearc-quest-population-data')
export POPULATION_BUCKET_NAME=your-population-bucket-name

# Run the API fetch
python population_api.py
```

#### Part 3: Data Analytics

```bash
cd part3_analytics

# Install dependencies
pip install -r requirements.txt

# Start Jupyter notebook
jupyter notebook data_analysis.ipynb
```

Run all cells in the notebook to perform the analysis.

## Configuration

### Environment Variables

The following environment variables can be configured:

| Variable | Default | Description |
|----------|---------|-------------|
| `BLS_BUCKET_NAME` | `rearc-quest-bls-data` | S3 bucket for BLS data |
| `POPULATION_BUCKET_NAME` | `rearc-quest-population-data` | S3 bucket for population data |
| `AWS_DEFAULT_REGION` | `us-east-1` | AWS region for resources |

### CDK Configuration

Edit `part4_infrastructure/cdk/app.py` to customize:
- AWS region
- Resource naming
- Tags and metadata

## Testing the Deployment

### 1. Verify S3 Buckets

```bash
# List BLS bucket contents
aws s3 ls s3://rearc-quest-bls-data/bls-data/

# List population bucket contents
aws s3 ls s3://rearc-quest-population-data/population-data/
```

### 2. Test Lambda Functions

```bash
# Manually invoke data processor
aws lambda invoke \
  --function-name rearc-quest-data-processor \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' \
  response.json

# Check the response
cat response.json

# Manually invoke analytics processor
aws lambda invoke \
  --function-name rearc-quest-analytics-processor \
  --cli-binary-format raw-in-base64-out \
  --payload '{
    "Records": [{
      "body": "{\"test\": true}"
    }]
  }' \
  analytics_response.json
```

### 3. Monitor CloudWatch Logs

```bash
# View data processor logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/rearc-quest-data-processor"

# Tail analytics processor logs
aws logs tail /aws/lambda/rearc-quest-analytics-processor --follow
```

## Scheduled Execution

The pipeline runs automatically daily at 6 AM UTC. To modify the schedule:

1. Edit `part4_infrastructure/cdk/pipeline_stack.py`
2. Update the `schedule` parameter in the EventBridge rule
3. Redeploy: `cdk deploy`

### Manual Trigger

To trigger the pipeline manually:

```bash
# Trigger data processor directly
aws events put-events \
  --entries Source=manual,DetailType="Manual Trigger",Detail='{}'
```

## Monitoring and Troubleshooting

### CloudWatch Dashboards

Access the AWS Console and navigate to CloudWatch to view:
- Lambda function metrics
- S3 bucket metrics
- SQS queue metrics
- Custom application logs

### Common Issues

1. **403 Forbidden on BLS website**
   - The script includes proper User-Agent headers
   - If issues persist, check BLS website status

2. **S3 Permission Errors**
   - Verify IAM roles have correct permissions
   - Check bucket policies and ACLs

3. **Lambda Timeout**
   - Data processor has 15-minute timeout
   - Analytics processor has 5-minute timeout
   - Increase if needed in CDK stack

4. **SQS Message Processing**
   - Check dead letter queue for failed messages
   - Verify Lambda event source mapping

### Debugging

Enable debug logging by setting environment variable:

```bash
export LOG_LEVEL=DEBUG
```

Or modify the Lambda functions to use DEBUG level logging.

## Cleanup

To remove all resources:

```bash
cd part4_infrastructure/cdk
cdk destroy

# If manual deployment, delete S3 buckets manually
aws s3 rb s3://rearc-quest-bls-data --force
aws s3 rb s3://rearc-quest-population-data --force
```

## Security Considerations

- All S3 buckets have public access blocked
- Lambda functions use least-privilege IAM roles
- No hardcoded credentials in source code
- VPC deployment can be added if required

## Cost Optimization

- S3 Intelligent Tiering can be enabled for cost savings
- Lambda functions are sized appropriately
- SQS messages have appropriate retention periods
- CloudWatch log retention can be configured

## Support

For issues or questions:
1. Check CloudWatch logs for error details
2. Review this deployment guide
3. Consult AWS documentation for service-specific issues