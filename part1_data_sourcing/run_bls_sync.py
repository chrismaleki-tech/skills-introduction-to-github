#!/usr/bin/env python3
"""
Demo runner for BLS Data Sync with Environment Configuration

This script demonstrates how to run the enhanced BLS data synchronization 
using environment variables from the connected GitHub repository.

Usage:
    python run_bls_sync.py

Environment Variables (set in GitHub repo secrets):
    AWS_ACCESS_KEY_ID       - AWS access key ID
    AWS_SECRET_ACCESS_KEY   - AWS secret access key  
    AWS_DEFAULT_REGION      - AWS region (default: us-east-2)
    BLS_BUCKET_NAME        - S3 bucket name (default: rearc-quest-bls-data)
    BLS_BASE_URL           - BLS base URL (default: https://download.bls.gov/pub/time.series/)
    BLS_MAX_WORKERS        - Max concurrent workers (default: 3)
    BLS_MAX_DEPTH          - Max recursion depth (default: 5)
    DEBUG                  - Enable debug logging (default: false)
"""

import os
import sys
from bls_data_sync import main, load_environment_config

def check_environment():
    """
    Check if required environment variables are set.
    """
    config = load_environment_config()
    
    print("🔍 Environment Configuration Check")
    print("=" * 40)
    
    # Required variables
    required_vars = {
        'AWS_ACCESS_KEY_ID': config['aws_access_key'],
        'AWS_SECRET_ACCESS_KEY': config['aws_secret_key']
    }
    
    # Optional variables with defaults
    optional_vars = {
        'AWS_DEFAULT_REGION': config['aws_region'],
        'BLS_BUCKET_NAME': config['bucket_name'],
        'BLS_BASE_URL': config['base_url'],
        'BLS_MAX_WORKERS': config['max_workers'],
        'BLS_MAX_DEPTH': config['max_depth'],
        'DEBUG': config['debug']
    }
    
    missing_required = []
    for var, value in required_vars.items():
        if value:
            print(f"✅ {var}: {'*' * min(8, len(str(value)))}")  # Mask sensitive values
        else:
            print(f"❌ {var}: NOT SET")
            missing_required.append(var)
    
    print("\n📋 Optional Configuration:")
    for var, value in optional_vars.items():
        print(f"📄 {var}: {value}")
    
    if missing_required:
        print(f"\n❌ Missing required environment variables: {', '.join(missing_required)}")
        print("\n💡 To set environment variables:")
        print("   1. In GitHub Actions: Set them as repository secrets")
        print("   2. Locally: Use export VAR_NAME=value or .env file")
        print("   3. Docker: Use -e VAR_NAME=value flags")
        return False
    
    print("\n✅ All required environment variables are set!")
    return True

def show_usage_examples():
    """
    Show usage examples for different environments.
    """
    print("\n📚 Usage Examples:")
    print("=" * 40)
    
    print("\n1️⃣ GitHub Actions (environment secrets):")
    print("   - Set AWS_ACCESS_KEY_ID in repo secrets")
    print("   - Set AWS_SECRET_ACCESS_KEY in repo secrets")
    print("   - Run: python run_bls_sync.py")
    
    print("\n2️⃣ Local Development:")
    print("   export AWS_ACCESS_KEY_ID='your_key_here'")
    print("   export AWS_SECRET_ACCESS_KEY='your_secret_here'")
    print("   export BLS_BUCKET_NAME='my-test-bucket'")
    print("   python run_bls_sync.py")
    
    print("\n3️⃣ Docker:")
    print("   docker run -e AWS_ACCESS_KEY_ID=key \\")
    print("              -e AWS_SECRET_ACCESS_KEY=secret \\")
    print("              -e BLS_BUCKET_NAME=bucket \\")
    print("              your-image python run_bls_sync.py")
    
    print("\n4️⃣ Custom Configuration:")
    print("   export BLS_BASE_URL='https://download.bls.gov/pub/time.series/ap/'")
    print("   export BLS_MAX_DEPTH='3'")
    print("   export BLS_MAX_WORKERS='5'")
    print("   export DEBUG='true'")
    print("   python run_bls_sync.py")

def main_runner():
    """
    Main runner function.
    """
    print("🚀 BLS Data Sync Runner")
    print("=" * 50)
    
    # Check environment first
    if not check_environment():
        show_usage_examples()
        print("\n❌ Environment check failed. Please configure required variables.")
        sys.exit(1)
    
    print("\n🎯 Starting BLS Data Synchronization...")
    print("=" * 50)
    
    # Run the actual sync
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Sync interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Sync failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ['--help', '-h']:
        print(__doc__)
        show_usage_examples()
        sys.exit(0)
    
    main_runner()