# Lambda Function Dependencies Fix Guide

## Issue Description

The AWS Lambda function `rearc-quest-data-processor` is failing with the following error:
```
[ERROR] Runtime.ImportModuleError: Unable to import module 'data_processor': No module named 'requests'
```

This error occurs because the Lambda function deployment doesn't include the required Python dependencies (`requests`, `beautifulsoup4`, `urllib3`).

## Root Cause

The CDK stack was configured to deploy Lambda functions using `lambda_.Code.from_asset("../lambda_functions")`, which only includes the Python source code but not the dependencies specified in `requirements.txt`.

## Solution

### 1. Created Build Scripts

Three build scripts have been created to package Lambda functions with their dependencies:

#### a) Minimal Package (for data_processor)
- **File**: `/workspace/part4_infrastructure/lambda_functions/build_minimal_package.sh`
- **Size**: ~1.7MB
- **Dependencies**: `requests`, `beautifulsoup4`, `urllib3`
- **Output**: `build-minimal/lambda-minimal-package.zip`

#### b) Full Package (for analytics_processor)
- **File**: `/workspace/part4_infrastructure/lambda_functions/build_lambda_package.sh`
- **Size**: ~60MB (exceeds Lambda 50MB limit)
- **Dependencies**: All requirements including pandas/numpy
- **Output**: `build/lambda-deployment-package.zip`

#### c) Analytics Package (attempted optimization)
- **File**: `/workspace/part4_infrastructure/lambda_functions/build_analytics_package.sh`
- **Size**: ~60MB (still too large)
- **Dependencies**: Full requirements for analytics processor only
- **Output**: `build-analytics/lambda-analytics-package.zip`

### 2. Updated CDK Stack

The CDK pipeline stack (`/workspace/part4_infrastructure/cdk/pipeline_stack.py`) has been updated:

```python
# BEFORE
code=lambda_.Code.from_asset("../lambda_functions")

# AFTER
code=lambda_.Code.from_asset("../lambda_functions/build-minimal/lambda-minimal-package.zip")
```

## Deployment Instructions

### Step 1: Build the Lambda Package
```bash
cd /workspace/part4_infrastructure/lambda_functions
./build_minimal_package.sh
```

### Step 2: Deploy via CDK
```bash
cd /workspace/part4_infrastructure/cdk

# Install dependencies
pip install -r requirements.txt

# Bootstrap CDK (if not already done)
cdk bootstrap

# Deploy the stack
cdk deploy --require-approval never
```

### Step 3: Direct Lambda Update (Alternative)
If CDK deployment is not available, you can update the Lambda function directly:

```bash
aws lambda update-function-code \
  --function-name rearc-quest-data-processor \
  --zip-file fileb://part4_infrastructure/lambda_functions/build-minimal/lambda-minimal-package.zip
```

## Analytics Processor Issue

The analytics processor requires pandas and numpy, which create deployment packages larger than the 50MB Lambda limit.

### Recommended Solutions:

1. **Lambda Layers**: Create a Lambda layer with pandas/numpy
2. **Container Images**: Use Docker-based Lambda functions
3. **External Processing**: Move analytics to ECS/Fargate

### Lambda Layer Approach (Recommended)
```bash
# Create layer package
mkdir layer-package
pip install pandas numpy -t layer-package/python/

# Create layer
aws lambda publish-layer-version \
  --layer-name pandas-numpy-layer \
  --zip-file fileb://layer-package.zip \
  --compatible-runtimes python3.9

# Update function to use layer
aws lambda update-function-configuration \
  --function-name rearc-quest-analytics-processor \
  --layers arn:aws:lambda:region:account:layer:pandas-numpy-layer:1
```

## Files Modified

1. `/workspace/part4_infrastructure/lambda_functions/requirements.minimal.txt` - Minimal dependencies
2. `/workspace/part4_infrastructure/lambda_functions/build_minimal_package.sh` - Build script
3. `/workspace/part4_infrastructure/cdk/pipeline_stack.py` - CDK stack update
4. `/workspace/part4_infrastructure/cdk/cdk.json` - Fixed Python path

## Testing

After deployment, test the Lambda function:
```bash
aws lambda invoke \
  --function-name rearc-quest-data-processor \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' \
  response.json

cat response.json
```

## Prevention

To prevent this issue in the future:
1. Always test Lambda deployments in a staging environment
2. Use CDK's bundling feature for automatic dependency management
3. Consider using Lambda layers for common dependencies
4. Monitor deployment package sizes

## Implementation Status

- ✅ Created minimal deployment package (1.7MB)
- ✅ Updated CDK stack configuration
- ✅ Fixed CDK app Python path
- ⚠️  CDK deployment pending (requires AWS CLI setup)
- ⚠️  Analytics processor still needs Lambda layers solution

## Next Steps

1. Set up AWS credentials and deploy the CDK stack
2. Implement Lambda layers for analytics processor
3. Test both Lambda functions end-to-end
4. Set up monitoring and alerting for future issues