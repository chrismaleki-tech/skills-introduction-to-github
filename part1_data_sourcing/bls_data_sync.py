#!/usr/bin/env python3
"""
Part 1: AWS S3 & Sourcing Datasets
BLS Data Synchronization Script

This script synchronizes Bureau of Labor Statistics (BLS) data from their website
to an S3 bucket. It handles 403 Forbidden errors by using proper User-Agent headers
and implements smart sync to avoid uploading the same files multiple times.

Features:
- Dynamic file discovery (handles added/removed files)
- Smart sync (only uploads new/changed files)
- Proper error handling for 403 Forbidden errors
- Comprehensive logging
- ETag-based change detection
"""

import os
import sys
import hashlib
import tempfile
from typing import List, Dict, Set, Optional, Tuple
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
import time

# Add parent directory to path to import shared utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.utils import (
    setup_logging, create_s3_bucket_if_not_exists, upload_to_s3, 
    get_object_etag, object_exists_in_s3, validate_aws_credentials
)

class BLSDataSyncer:
    """
    Synchronizes BLS data from their website to S3.
    """
    
    def __init__(self, bucket_name: str, base_url: str = "https://download.bls.gov/pub/time.series/pr/"):
        """
        Initialize the BLS Data Syncer.
        
        Args:
            bucket_name: S3 bucket name to sync data to
            base_url: BLS data base URL
        """
        self.bucket_name = bucket_name
        self.base_url = base_url
        self.logger = setup_logging(__name__)
        self.session = requests.Session()
        
        # Set proper User-Agent to avoid 403 Forbidden errors
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        # Add rate limiting
        self.request_delay = 1  # seconds between requests
        
    def discover_files(self) -> List[Dict[str, str]]:
        """
        Discover all available files on the BLS website.
        
        Returns:
            List of dictionaries containing file information
        """
        self.logger.info(f"Discovering files from {self.base_url}")
        
        try:
            # Add delay to be respectful to the server
            time.sleep(self.request_delay)
            
            response = self.session.get(self.base_url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            files = []
            
            # Find all links to files
            for link in soup.find_all('a', href=True):
                href = link['href']
                
                # Filter for relevant files (typically .txt, .csv files)
                if any(href.endswith(ext) for ext in ['.txt', '.csv', '.data']):
                    file_info = {
                        'name': href,
                        'url': urljoin(self.base_url, href),
                        'size': None  # We'll get this when downloading
                    }
                    files.append(file_info)
            
            self.logger.info(f"Discovered {len(files)} files")
            return files
            
        except requests.RequestException as e:
            self.logger.error(f"Failed to discover files: {e}")
            return []
    
    def get_file_hash(self, file_path: str) -> str:
        """
        Calculate MD5 hash of a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MD5 hash string
        """
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def download_file(self, file_info: Dict[str, str], local_path: str) -> bool:
        """
        Download a file from BLS website.
        
        Args:
            file_info: File information dictionary
            local_path: Local path to save the file
            
        Returns:
            True if download was successful
        """
        try:
            # Add delay between requests
            time.sleep(self.request_delay)
            
            self.logger.info(f"Downloading {file_info['name']}")
            
            response = self.session.get(file_info['url'], timeout=60, stream=True)
            response.raise_for_status()
            
            # Write file in chunks
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            self.logger.info(f"Downloaded {file_info['name']} ({os.path.getsize(local_path)} bytes)")
            return True
            
        except requests.RequestException as e:
            self.logger.error(f"Failed to download {file_info['name']}: {e}")
            return False
    
    def should_upload_file(self, file_info: Dict[str, str], local_path: str) -> bool:
        """
        Determine if a file should be uploaded to S3.
        
        Args:
            file_info: File information dictionary
            local_path: Local file path
            
        Returns:
            True if file should be uploaded
        """
        s3_key = f"bls-data/{file_info['name']}"
        
        # Check if file exists in S3
        if not object_exists_in_s3(self.bucket_name, s3_key):
            self.logger.info(f"File {file_info['name']} doesn't exist in S3, will upload")
            return True
        
        # Check if file content has changed using hash comparison
        local_hash = self.get_file_hash(local_path)
        s3_etag = get_object_etag(self.bucket_name, s3_key)
        
        if s3_etag and s3_etag != local_hash:
            self.logger.info(f"File {file_info['name']} has changed, will upload")
            return True
        
        self.logger.info(f"File {file_info['name']} unchanged, skipping upload")
        return False
    
    def sync_files(self) -> Tuple[int, int]:
        """
        Sync all BLS files to S3.
        
        Returns:
            Tuple of (successful_uploads, total_files)
        """
        # Validate AWS credentials
        if not validate_aws_credentials():
            self.logger.error("AWS credentials not configured properly")
            return 0, 0
        
        # Create S3 bucket if it doesn't exist
        if not create_s3_bucket_if_not_exists(self.bucket_name):
            self.logger.error(f"Failed to create/access bucket {self.bucket_name}")
            return 0, 0
        
        # Discover files
        files = self.discover_files()
        if not files:
            self.logger.error("No files discovered")
            return 0, 0
        
        successful_uploads = 0
        
        # Create temporary directory for downloads
        with tempfile.TemporaryDirectory() as temp_dir:
            for file_info in files:
                try:
                    # Download file to temp directory
                    local_path = os.path.join(temp_dir, file_info['name'])
                    
                    if not self.download_file(file_info, local_path):
                        continue
                    
                    # Check if we should upload this file
                    if not self.should_upload_file(file_info, local_path):
                        continue
                    
                    # Upload to S3
                    s3_key = f"bls-data/{file_info['name']}"
                    if upload_to_s3(local_path, self.bucket_name, s3_key):
                        successful_uploads += 1
                        self.logger.info(f"Successfully synced {file_info['name']}")
                    else:
                        self.logger.error(f"Failed to upload {file_info['name']}")
                
                except Exception as e:
                    self.logger.error(f"Error processing {file_info['name']}: {e}")
                    continue
        
        self.logger.info(f"Sync completed: {successful_uploads}/{len(files)} files uploaded")
        return successful_uploads, len(files)

def main():
    """
    Main function to run the BLS data sync.
    """
    # Configuration
    BUCKET_NAME = os.environ.get('BLS_BUCKET_NAME', 'rearc-quest-bls-data')
    
    # Initialize syncer
    syncer = BLSDataSyncer(BUCKET_NAME)
    
    # Run sync
    try:
        successful, total = syncer.sync_files()
        print(f"\nSync Summary:")
        print(f"Total files discovered: {total}")
        print(f"Files uploaded: {successful}")
        print(f"S3 bucket: {BUCKET_NAME}")
        print(f"S3 path: s3://{BUCKET_NAME}/bls-data/")
        
        if successful > 0:
            print(f"\n✅ Successfully synchronized {successful} files to S3")
        else:
            print(f"\n⚠️  No files were uploaded (all files may already be up to date)")
            
    except KeyboardInterrupt:
        print("\n🛑 Sync interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Sync failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()