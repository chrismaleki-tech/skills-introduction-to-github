"""
Shared utilities for the Rearc Data Quest project.
"""

import os
import logging
import boto3
from botocore.exceptions import ClientError
from typing import Optional, Dict, Any
import json
from datetime import datetime

def setup_logging(name: str, level: str = 'INFO') -> logging.Logger:
    """
    Set up logging configuration.
    
    Args:
        name: Logger name
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger

def get_s3_client(region_name: str = 'us-east-1') -> boto3.client:
    """
    Create and return an S3 client.
    
    Args:
        region_name: AWS region name
    
    Returns:
        S3 client instance
    """
    return boto3.client('s3', region_name=region_name)

def create_s3_bucket_if_not_exists(bucket_name: str, region: str = 'us-east-1') -> bool:
    """
    Create S3 bucket if it doesn't exist.
    
    Args:
        bucket_name: Name of the S3 bucket
        region: AWS region
    
    Returns:
        True if bucket exists or was created successfully
    """
    s3_client = get_s3_client(region)
    logger = setup_logging(__name__)
    
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        logger.info(f"Bucket {bucket_name} already exists")
        return True
    except ClientError as e:
        error_code = int(e.response['Error']['Code'])
        if error_code == 404:
            try:
                if region == 'us-east-1':
                    s3_client.create_bucket(Bucket=bucket_name)
                else:
                    s3_client.create_bucket(
                        Bucket=bucket_name,
                        CreateBucketConfiguration={'LocationConstraint': region}
                    )
                logger.info(f"Created bucket {bucket_name}")
                return True
            except ClientError as create_error:
                logger.error(f"Failed to create bucket {bucket_name}: {create_error}")
                return False
        else:
            logger.error(f"Error checking bucket {bucket_name}: {e}")
            return False

def upload_to_s3(file_path: str, bucket_name: str, object_key: str, 
                 extra_args: Optional[Dict[str, Any]] = None) -> bool:
    """
    Upload a file to S3.
    
    Args:
        file_path: Local file path
        bucket_name: S3 bucket name
        object_key: S3 object key
        extra_args: Additional arguments for upload
    
    Returns:
        True if upload was successful
    """
    s3_client = get_s3_client()
    logger = setup_logging(__name__)
    
    try:
        s3_client.upload_file(file_path, bucket_name, object_key, ExtraArgs=extra_args)
        logger.info(f"Uploaded {file_path} to s3://{bucket_name}/{object_key}")
        return True
    except ClientError as e:
        logger.error(f"Failed to upload {file_path}: {e}")
        return False

def download_from_s3(bucket_name: str, object_key: str, file_path: str) -> bool:
    """
    Download a file from S3.
    
    Args:
        bucket_name: S3 bucket name
        object_key: S3 object key
        file_path: Local file path to save
    
    Returns:
        True if download was successful
    """
    s3_client = get_s3_client()
    logger = setup_logging(__name__)
    
    try:
        s3_client.download_file(bucket_name, object_key, file_path)
        logger.info(f"Downloaded s3://{bucket_name}/{object_key} to {file_path}")
        return True
    except ClientError as e:
        logger.error(f"Failed to download {object_key}: {e}")
        return False

def object_exists_in_s3(bucket_name: str, object_key: str) -> bool:
    """
    Check if an object exists in S3.
    
    Args:
        bucket_name: S3 bucket name
        object_key: S3 object key
    
    Returns:
        True if object exists
    """
    s3_client = get_s3_client()
    
    try:
        s3_client.head_object(Bucket=bucket_name, Key=object_key)
        return True
    except ClientError:
        return False

def get_object_etag(bucket_name: str, object_key: str) -> Optional[str]:
    """
    Get the ETag of an S3 object.
    
    Args:
        bucket_name: S3 bucket name
        object_key: S3 object key
    
    Returns:
        ETag string or None if object doesn't exist
    """
    s3_client = get_s3_client()
    
    try:
        response = s3_client.head_object(Bucket=bucket_name, Key=object_key)
        return response['ETag'].strip('"')
    except ClientError:
        return None

def save_json_to_s3(data: Dict[str, Any], bucket_name: str, object_key: str) -> bool:
    """
    Save JSON data directly to S3.
    
    Args:
        data: Dictionary to save as JSON
        bucket_name: S3 bucket name
        object_key: S3 object key
    
    Returns:
        True if save was successful
    """
    s3_client = get_s3_client()
    logger = setup_logging(__name__)
    
    try:
        json_string = json.dumps(data, indent=2, default=str)
        s3_client.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=json_string,
            ContentType='application/json'
        )
        logger.info(f"Saved JSON data to s3://{bucket_name}/{object_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to save JSON to S3: {e}")
        return False

def get_timestamp() -> str:
    """
    Get current timestamp as string.
    
    Returns:
        Formatted timestamp string
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def validate_aws_credentials() -> bool:
    """
    Validate AWS credentials are configured.
    
    Returns:
        True if credentials are valid
    """
    try:
        sts = boto3.client('sts')
        sts.get_caller_identity()
        return True
    except Exception:
        return False