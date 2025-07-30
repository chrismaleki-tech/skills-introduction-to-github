# AWS Credentials Setup Guide

The error "Credentials could not be loaded, please check your action inputs: Could not load credentials from any providers" indicates that AWS credentials are not configured in your environment.

## Quick Setup Options

### Option 1: Interactive Setup Script (Recommended)

Run the provided setup script:

```bash
./setup_credentials.sh
```

This script will:
- Prompt you for your AWS credentials
- Save them to a `.env` file
- Test the credentials
- Set up environment variables

### Option 2: Manual Environment Variables

Export your AWS credentials directly:

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_DEFAULT_REGION="us-east-2"  # or your preferred region
```

### Option 3: Create .env File Manually

Create a `.env` file in the project root:

```bash
cat > .env << 'EOF'
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_DEFAULT_REGION=us-east-2
EOF
```

Then load it:
```bash
source venv/bin/activate
python3 -c "from dotenv import load_dotenv; load_dotenv()"
```

### Option 4: AWS CLI Configuration (if available)

If you had AWS CLI working, you could run:
```bash
aws configure
```

But since we encountered issues with the AWS CLI installation, use the methods above.

## Getting Your AWS Credentials

1. **AWS Console Method:**
   - Log into AWS Console
   - Go to IAM → Users → [Your Username] → Security credentials
   - Create new Access Key if needed
   - Copy the Access Key ID and Secret Access Key

2. **AWS CLI Method:**
   - If you have AWS CLI elsewhere: `aws configure list`
   - Copy the credentials from `~/.aws/credentials`

3. **Temporary Credentials (AWS SSO/Federated):**
   - If using AWS SSO, you may also need `AWS_SESSION_TOKEN`
   - These credentials expire and need refreshing

## Required Permissions

Your AWS credentials need the following permissions for this project:
- S3 bucket access (read/write)
- Lambda function management
- SQS queue access
- CloudFormation/CDK deployment permissions
- IAM permissions for creating roles

## Testing Your Credentials

After setting up credentials, test them:

```bash
source venv/bin/activate
python3 -c "
import boto3
try:
    sts = boto3.client('sts')
    identity = sts.get_caller_identity()
    print('✅ Credentials working!')
    print(f'Account: {identity[\"Account\"]}')
    print(f'User: {identity[\"Arn\"]}')
except Exception as e:
    print(f'❌ Error: {e}')
"
```

## Security Best Practices

1. **Never commit credentials to git** - `.env` is in `.gitignore`
2. **Use IAM roles when possible** - Especially for production
3. **Rotate credentials regularly**
4. **Use least privilege principle** - Only grant necessary permissions
5. **Use temporary credentials when available**

## Troubleshooting

### Common Issues:

1. **"NoCredentialsError"**: Credentials not set or loaded
   - Solution: Use one of the setup methods above

2. **"InvalidAccessKeyId"**: Wrong access key
   - Solution: Double-check your AWS Access Key ID

3. **"SignatureDoesNotMatch"**: Wrong secret key
   - Solution: Double-check your AWS Secret Access Key

4. **"UnauthorizedOperation"**: Insufficient permissions
   - Solution: Add necessary IAM permissions to your user/role

5. **"TokenRefreshRequired"**: Temporary credentials expired
   - Solution: Refresh your temporary credentials

### Environment Loading:

If credentials are in `.env` but not loading:

```bash
# Load into current session
export $(grep -v '^#' .env | xargs)

# Or use python-dotenv
python3 -c "from dotenv import load_dotenv; load_dotenv(); import os; print('AWS_ACCESS_KEY_ID' in os.environ)"
```

## Project Structure Context

This project expects credentials for:
- **Part 1**: BLS data sourcing to S3
- **Part 2**: Population API integration 
- **Part 3**: Analytics processing
- **Part 4**: Infrastructure deployment with CDK

Each part requires AWS S3, Lambda, and related service access.