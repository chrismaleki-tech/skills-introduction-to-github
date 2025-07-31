#!/usr/bin/env python3
"""
Demo runner for Part 1: BLS Data Sync with Moto (Mock AWS)

This script demonstrates Part 1 functionality using moto to mock AWS S3,
allowing you to see what files would be synchronized without real AWS credentials.
"""

import os
import sys
from moto import mock_aws
import boto3
from bls_data_sync import BLSDataSyncer, load_environment_config

# Patch the shared utils to work with moto
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared import utils

# Store original functions
_original_get_s3_client = utils.get_s3_client
_original_validate_aws_credentials = utils.validate_aws_credentials

def mock_get_s3_client(region_name='us-east-1'):
    """Mock S3 client that works with moto."""
    return boto3.client('s3', region_name=region_name)

def mock_validate_aws_credentials():
    """Mock AWS credentials validation that always returns True."""
    return True

@mock_aws
def run_demo():
    """Run BLS data sync demo with mocked S3."""
    
    # Patch the utils functions
    utils.get_s3_client = mock_get_s3_client
    utils.validate_aws_credentials = mock_validate_aws_credentials
    
    print("🚀 Part 1 Demo: BLS Data Synchronization")
    print("=" * 60)
    print("📝 Using moto to simulate AWS S3 (no real AWS credentials needed)")
    print()
    
    # Set up environment for demo
    os.environ.setdefault('AWS_ACCESS_KEY_ID', 'testing')
    os.environ.setdefault('AWS_SECRET_ACCESS_KEY', 'testing')
    os.environ.setdefault('AWS_DEFAULT_REGION', 'us-east-2')
    os.environ.setdefault('BLS_BUCKET_NAME', 'rearc-quest-bls-data-demo')
    os.environ.setdefault('BLS_MAX_WORKERS', '2')  # Reduce for demo
    os.environ.setdefault('BLS_MAX_DEPTH', '2')   # Reduce for demo
    
    # Load configuration
    config = load_environment_config()
    
    print("🔧 Configuration:")
    for key, value in config.items():
        if 'key' in key.lower() or 'secret' in key.lower():
            display_value = '***DEMO***' if value else 'NOT SET'
        else:
            display_value = value
        print(f"   {key}: {display_value}")
    print()
    
    # Create mock S3 client and bucket
    s3_client = boto3.client('s3', region_name=config['aws_region'])
    s3_client.create_bucket(
        Bucket=config['bucket_name'],
        CreateBucketConfiguration={'LocationConstraint': config['aws_region']}
    )
    
    print(f"✅ Created mock S3 bucket: {config['bucket_name']}")
    print()
    
    # Initialize syncer
    syncer = BLSDataSyncer(
        bucket_name=config['bucket_name'],
        base_url=config['base_url']
    )
    
    print("🔍 Starting file discovery and sync simulation...")
    print("=" * 60)
    
    try:
        # Run the sync
        successful, total = syncer.sync_files(
            preserve_directory_structure=config.get('preserve_directory_structure', False)
        )
        
        print("\n" + "=" * 60)
        print("📊 DEMO SYNC RESULTS:")
        print("=" * 60)
        print(f"📈 Total files discovered: {total}")
        print(f"📤 Files uploaded to mock S3: {successful}")
        print(f"🪣 Mock S3 bucket: {config['bucket_name']}")
        print(f"🔗 Mock S3 path: s3://{config['bucket_name']}/bls-data/")
        print(f"🌐 Source: {config['base_url']}")
        
        # List files in mock bucket
        print("\n🗂️  Files in mock S3 bucket:")
        response = s3_client.list_objects_v2(Bucket=config['bucket_name'])
        if 'Contents' in response:
            for i, obj in enumerate(response['Contents'][:10], 1):
                print(f"   {i:2d}. {obj['Key']} ({obj['Size']} bytes)")
            if len(response['Contents']) > 10:
                print(f"   ... and {len(response['Contents']) - 10} more files")
        else:
            print("   (No files found)")
        
        print("\n✅ Demo completed successfully!")
        print("💡 This demonstrates what Part 1 would do with real AWS credentials.")
        
        return successful, total
        
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()
        return 0, 0
    finally:
        # Restore original functions
        utils.get_s3_client = _original_get_s3_client
        utils.validate_aws_credentials = _original_validate_aws_credentials

if __name__ == "__main__":
    run_demo()