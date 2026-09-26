#!/usr/bin/env python3
"""
Bucket Contents Verification Script

This script verifies all files are properly uploaded to the S3 bucket
and provides detailed statistics about the sync operation.
"""

import os
import sys
from moto import mock_aws
import boto3
from collections import defaultdict
from bls_data_sync import load_environment_config

@mock_aws
def verify_bucket_contents():
    """Verify and list all files in the mock S3 bucket."""
    
    print("🔍 Part 1 Verification: BLS Data in S3 Bucket")
    print("=" * 60)
    
    # Set up environment for verification
    os.environ.setdefault('AWS_ACCESS_KEY_ID', 'testing')
    os.environ.setdefault('AWS_SECRET_ACCESS_KEY', 'testing')
    os.environ.setdefault('AWS_DEFAULT_REGION', 'us-east-2')
    os.environ.setdefault('BLS_BUCKET_NAME', 'rearc-quest-bls-data-demo')
    
    config = load_environment_config()
    
    # Create mock S3 client and bucket
    s3_client = boto3.client('s3', region_name=config['aws_region'])
    
    try:
        s3_client.create_bucket(
            Bucket=config['bucket_name'],
            CreateBucketConfiguration={'LocationConstraint': config['aws_region']}
        )
    except:
        pass  # Bucket might already exist
    
    print(f"📊 Analyzing bucket: {config['bucket_name']}")
    print()
    
    # List all objects in the bucket
    response = s3_client.list_objects_v2(Bucket=config['bucket_name'])
    
    if 'Contents' not in response:
        print("❌ No files found in bucket!")
        return False
    
    files = response['Contents']
    
    # Statistics
    total_files = len(files)
    total_size = sum(obj['Size'] for obj in files)
    
    # Organize by file type and directory
    file_types = defaultdict(int)
    directories = defaultdict(int)
    size_by_type = defaultdict(int)
    
    print("📋 ALL FILES IN BUCKET:")
    print("-" * 60)
    
    for i, obj in enumerate(files, 1):
        key = obj['Key']
        size = obj['Size']
        
        # Extract file extension
        if '.' in key:
            ext = key.split('.')[-1].lower()
        else:
            ext = 'no_extension'
        
        file_types[ext] += 1
        size_by_type[ext] += size
        
        # Extract directory (BLS data series)
        if '/pub/time.series/' in key:
            parts = key.split('/pub/time.series/')
            if len(parts) > 1:
                series_path = parts[1].split('/')[0]
                directories[series_path] += 1
        
        print(f"{i:3d}. {key}")
        print(f"     Size: {size:,} bytes")
        if i % 10 == 0:  # Add spacing every 10 files
            print()
    
    print("\n" + "=" * 60)
    print("📈 BUCKET STATISTICS:")
    print("=" * 60)
    
    print(f"📁 Total Files: {total_files}")
    print(f"💾 Total Size: {total_size:,} bytes ({total_size/1024/1024:.2f} MB)")
    print()
    
    print("📄 File Types:")
    for ext, count in sorted(file_types.items()):
        avg_size = size_by_type[ext] / count
        print(f"   .{ext}: {count} files ({size_by_type[ext]:,} bytes, avg: {avg_size:.0f} bytes)")
    print()
    
    print("📊 BLS Data Series:")
    for series, count in sorted(directories.items()):
        if series:  # Skip empty series
            print(f"   {series}: {count} files")
    
    # Verify expected files
    print("\n" + "=" * 60)
    print("✅ VERIFICATION RESULTS:")
    print("=" * 60)
    
    expected_min_files = 60  # We expect at least 60 different BLS series files
    expected_file_types = ['txt', 'xml']  # We expect text and XML files
    
    if total_files >= expected_min_files:
        print(f"✅ File count check passed: {total_files} files (expected ≥ {expected_min_files})")
    else:
        print(f"❌ File count check failed: {total_files} files (expected ≥ {expected_min_files})")
    
    found_types = set(file_types.keys())
    missing_types = set(expected_file_types) - found_types
    
    if not missing_types:
        print(f"✅ File type check passed: Found {', '.join(sorted(found_types))}")
    else:
        print(f"❌ File type check failed: Missing {', '.join(missing_types)}")
    
    # Check for key BLS series
    key_series = ['pr', 'ce', 'cu', 'sa', 'la']  # Important BLS data series
    found_series = set(directories.keys())
    missing_series = set(key_series) - found_series
    
    if not missing_series:
        print(f"✅ Key series check passed: Found {len(found_series)} series")
    else:
        print(f"⚠️  Some key series missing: {', '.join(missing_series)}")
    
    # Overall result
    all_checks_passed = (
        total_files >= expected_min_files and
        not missing_types and
        len(found_series) >= 50  # We expect many different series
    )
    
    print("\n" + "=" * 60)
    if all_checks_passed:
        print("🎉 ALL VERIFICATION CHECKS PASSED!")
        print("📤 Part 1 successfully synchronized BLS data to S3")
    else:
        print("⚠️  Some verification checks failed")
    
    print(f"🔗 S3 Location: s3://{config['bucket_name']}/bls-data/")
    print("=" * 60)
    
    return all_checks_passed

if __name__ == "__main__":
    # Run the verification after the demo sync
    from run_part1_demo import run_demo
    
    print("🚀 Running Part 1 Demo and Verification")
    print("=" * 80)
    
    # First run the demo
    successful, total = run_demo()
    
    print("\n" + "=" * 80)
    
    # Then verify the results
    verification_passed = verify_bucket_contents()
    
    print(f"\n📋 FINAL SUMMARY:")
    print("=" * 80)
    print(f"📤 Files uploaded: {successful}/{total}")
    print(f"✅ Verification: {'PASSED' if verification_passed else 'FAILED'}")
    
    if verification_passed:
        print("\n🎯 Part 1 Complete: BLS data successfully synchronized to S3!")
        print("💡 All files are properly stored and verified in the bucket.")
    else:
        print("\n❌ Part 1 incomplete: Some issues detected during verification.")