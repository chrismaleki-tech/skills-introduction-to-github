#!/usr/bin/env python3
"""
Configuration Test Script for BLS Data Sync

This script tests the environment configuration and basic functionality
without performing the full sync operation.

Usage:
    python test_config.py
"""

import os
import sys
from bls_data_sync import BLSDataSyncer, load_environment_config
from shared.utils import validate_aws_credentials

def test_environment_config():
    """Test environment configuration loading."""
    print("🧪 Testing Environment Configuration")
    print("=" * 50)
    
    try:
        config = load_environment_config()
        
        print("✅ Configuration loaded successfully:")
        for key, value in config.items():
            if 'key' in key.lower() or 'secret' in key.lower():
                # Mask sensitive values
                display_value = '***MASKED***' if value else 'NOT SET'
            else:
                display_value = value
            print(f"   {key}: {display_value}")
        
        return True
    except Exception as e:
        print(f"❌ Configuration loading failed: {e}")
        return False

def test_aws_credentials():
    """Test AWS credentials validation."""
    print("\n🔐 Testing AWS Credentials")
    print("=" * 50)
    
    try:
        if validate_aws_credentials():
            print("✅ AWS credentials are valid and accessible")
            return True
        else:
            print("❌ AWS credentials validation failed")
            return False
    except Exception as e:
        print(f"❌ AWS credential test error: {e}")
        return False

def test_bls_connection():
    """Test basic BLS website connectivity."""
    print("\n🌐 Testing BLS Website Connectivity")
    print("=" * 50)
    
    try:
        config = load_environment_config()
        syncer = BLSDataSyncer(
            bucket_name=config['bucket_name'],
            base_url=config['base_url']
        )
        
        # Test connection by trying to access the base URL
        import requests
        response = syncer.session.head(config['base_url'], timeout=10)
        
        if response.status_code == 200:
            print(f"✅ Successfully connected to {config['base_url']}")
            print(f"   Status Code: {response.status_code}")
            return True
        else:
            print(f"⚠️  Connected but received status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ BLS connection test failed: {e}")
        return False

def test_file_discovery_sample():
    """Test file discovery with limited depth."""
    print("\n🔍 Testing File Discovery (Sample)")
    print("=" * 50)
    
    try:
        config = load_environment_config()
        
        # Create syncer with limited depth for testing
        syncer = BLSDataSyncer(
            bucket_name=config['bucket_name'],
            base_url=config['base_url']
        )
        syncer.max_depth = 1  # Limit to 1 level for testing
        
        print(f"Discovering files from {config['base_url']} (depth=1)...")
        
        # Discover files with limited recursion
        files = syncer.discover_files_recursive(config['base_url'], depth=0)
        
        if files:
            print(f"✅ Successfully discovered {len(files)} files")
            print("Sample files found:")
            for i, file_info in enumerate(files[:5]):  # Show first 5 files
                print(f"   {i+1}. {file_info['name']} ({file_info['url']})")
            
            if len(files) > 5:
                print(f"   ... and {len(files) - 5} more files")
            
            return True
        else:
            print("⚠️  No files discovered")
            return False
            
    except Exception as e:
        print(f"❌ File discovery test failed: {e}")
        return False

def main():
    """Run all configuration tests."""
    print("🔬 BLS Data Sync Configuration Tests")
    print("=" * 50)
    
    tests = [
        ("Environment Config", test_environment_config),
        ("AWS Credentials", test_aws_credentials),
        ("BLS Connectivity", test_bls_connection),
        ("File Discovery", test_file_discovery_sample)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except KeyboardInterrupt:
            print("\n🛑 Tests interrupted by user")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Test '{test_name}' failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Configuration looks good.")
        print("\n💡 You can now run the full sync with:")
        print("   python bls_data_sync.py")
        print("   # or")
        print("   python run_bls_sync.py")
    else:
        print("⚠️  Some tests failed. Please check your configuration.")
        print("\n🔧 Common fixes:")
        print("   1. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        print("   2. Check internet connectivity")
        print("   3. Verify AWS permissions")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)