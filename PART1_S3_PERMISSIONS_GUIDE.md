# Part 1 S3 Permissions Guide

## Overview

Part 1 (BLS Data Sync) requires specific AWS S3 permissions to function properly. This guide provides the exact IAM policy needed and step-by-step instructions to apply it.

## Required S3 Permissions

The Part 1 BLS data sync script needs these AWS permissions:

### Core S3 Operations
- **`s3:CreateBucket`** - Create the BLS data bucket if it doesn't exist
- **`s3:HeadBucket`** - Check if bucket exists and is accessible
- **`s3:PutObject`** - Upload BLS data files to S3
- **`s3:HeadObject`** - Check if objects exist and get ETags for change detection
- **`s3:GetObjectVersion`** - Handle object versioning
- **`s3:ListBucket`** - List bucket contents
- **`s3:GetBucketLocation`** - Get bucket region information

### AWS Credential Validation
- **`sts:GetCallerIdentity`** - Validate AWS credentials are working

### Target Bucket
- **Bucket Name**: `rearc-quest-bls-data`
- **S3 Path**: `s3://rearc-quest-bls-data/bls-data/`

## Quick Fix

### Automated Setup (Recommended)

Run the automated permissions fix script:

```bash
./fix_part1_s3_permissions.sh
```

This script will:
1. ✅ Check AWS credentials
2. ✅ Create the IAM policy 
3. ✅ Attach it to your IAM user
4. ✅ Test S3 permissions
5. ✅ Verify everything works

### Manual Setup

If you prefer manual setup or the script doesn't work:

#### 1. Create IAM Policy

**Policy Name**: `Part1BLSDataSyncS3Policy`

**Policy JSON** (located in `aws/iam-policy-part1-s3.json`):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Part1BLSDataSyncS3Permissions",
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:HeadBucket",
                "s3:PutObject",
                "s3:HeadObject",
                "s3:GetObjectVersion",
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:PutBucketVersioning"
            ],
            "Resource": [
                "arn:aws:s3:::rearc-quest-bls-data",
                "arn:aws:s3:::rearc-quest-bls-data/*"
            ]
        },
        {
            "Sid": "Part1AWSCredentialValidation",
            "Effect": "Allow",
            "Action": [
                "sts:GetCallerIdentity"
            ],
            "Resource": "*"
        }
    ]
}
```

#### 2. Attach Policy to User/Role

**For IAM Users:**
```bash
# Create the policy
aws iam create-policy \
    --policy-name Part1BLSDataSyncS3Policy \
    --policy-document file://aws/iam-policy-part1-s3.json

# Attach to your user (replace YOUR_USERNAME)
aws iam attach-user-policy \
    --user-name YOUR_USERNAME \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/Part1BLSDataSyncS3Policy
```

**For IAM Roles:**
```bash
# Attach to your role (replace YOUR_ROLE_NAME)
aws iam attach-role-policy \
    --role-name YOUR_ROLE_NAME \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/Part1BLSDataSyncS3Policy
```

#### 3. AWS Console Method

1. Go to **AWS Console → IAM → Policies**
2. Click **"Create policy"**
3. Switch to **JSON** tab
4. Paste the policy JSON from above
5. Name it `Part1BLSDataSyncS3Policy`
6. Go to **IAM → Users** (or **Roles**)
7. Select your user/role
8. Click **"Attach policies"**
9. Search for and attach `Part1BLSDataSyncS3Policy`

## Testing S3 Permissions

After applying the permissions, test them:

### 1. Credential Validation
```bash
aws sts get-caller-identity
```

### 2. Bucket Operations
```bash
# Test bucket access
aws s3api head-bucket --bucket rearc-quest-bls-data

# If bucket doesn't exist, create it
aws s3 mb s3://rearc-quest-bls-data
```

### 3. Object Operations
```bash
# Test file upload
echo "test" > test.txt
aws s3 cp test.txt s3://rearc-quest-bls-data/test/
aws s3 rm s3://rearc-quest-bls-data/test/test.txt
rm test.txt
```

### 4. Run Part 1 Script
```bash
cd part1_data_sourcing
python3 bls_data_sync.py
```

## Troubleshooting

### Common Error Messages

#### `AccessDenied` Errors
```
An error occurred (AccessDenied) when calling the CreateBucket operation
```
**Solution**: Ensure you have `s3:CreateBucket` permission and the bucket name is unique globally.

#### `NoCredentialsError`
```
Unable to locate credentials
```
**Solution**: Configure AWS credentials:
```bash
aws configure
# OR
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

#### `InvalidUserID.NotFound`
```
The AWS Access Key Id you provided does not exist in our records
```
**Solution**: Check your AWS Access Key ID is correct.

#### `SignatureDoesNotMatch`
```
The request signature we calculated does not match the signature you provided
```
**Solution**: Check your AWS Secret Access Key is correct.

### Verification Commands

```bash
# Check current AWS identity
aws sts get-caller-identity

# List attached policies for your user
aws iam list-attached-user-policies --user-name YOUR_USERNAME

# Test specific S3 operation
aws s3api head-bucket --bucket rearc-quest-bls-data
```

## Alternative: Use Managed Policy

If you prefer broader permissions and trust your environment, you can use AWS managed policy:

```bash
# Attach S3 full access (broader permissions)
aws iam attach-user-policy \
    --user-name YOUR_USERNAME \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

**Note**: This gives full S3 access to all buckets, which is broader than needed but simpler to manage.

## Security Considerations

1. **Least Privilege**: The custom policy only grants access to the specific bucket needed
2. **Resource Scoping**: Permissions are limited to `rearc-quest-bls-data` bucket only
3. **No Deletion Rights**: The policy doesn't include delete operations for safety
4. **Credential Validation**: Only allows checking identity, not modifying credentials

## Integration with CDK (Part 4)

Note that Part 4 CDK deployment requires **additional** permissions beyond Part 1:
- CloudFormation permissions
- IAM role creation
- Lambda deployment
- SQS queue management

The Part 1 permissions are **separate** from CDK deployment issues. If CDK deployment fails, refer to:
- `CDK_DEPLOYMENT_ERROR_SOLUTION.md`
- `fix_cdk_deployment_error.sh`

## Summary

✅ **Part 1 S3 permissions are now properly defined and can be applied**  
✅ **Automated script available for easy setup**  
✅ **Manual instructions provided for flexibility**  
✅ **Testing procedures included for verification**  
✅ **Troubleshooting guide covers common issues**  

Run `./fix_part1_s3_permissions.sh` to get started immediately!