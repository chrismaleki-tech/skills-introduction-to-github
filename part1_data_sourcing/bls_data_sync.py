#!/usr/bin/env python3
"""
Part 1: AWS S3 & Sourcing Datasets
BLS Data Synchronization Script

This script synchronizes Bureau of Labor Statistics (BLS) data from their website
to an S3 bucket. It handles 403 Forbidden errors by using proper User-Agent headers
and implements smart sync to avoid uploading the same files multiple times.

Enhanced Features:
- Dynamic recursive file discovery (handles added/removed files from all subdirectories)
- Smart sync (only uploads new/changed files)
- Proper error handling for 403 Forbidden errors
- Comprehensive logging
- ETag-based change detection
- Uses environment variables from GitHub repo
- Recursive directory traversal
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
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Add parent directory to path to import shared utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.utils import (
    setup_logging, create_s3_bucket_if_not_exists, upload_to_s3, 
    get_object_etag, object_exists_in_s3, validate_aws_credentials
)

class BLSDataSyncer:
    """
    Synchronizes BLS data from their website to S3 with recursive discovery.
    """
    
    def __init__(self, bucket_name: str, base_url: str = "https://download.bls.gov/pub/time.series/"):
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
        self.discovered_files = []
        self.discovered_dirs = set()
        self.processed_urls = set()
        self.lock = threading.Lock()
        
        # Set proper User-Agent to avoid 403 Forbidden errors
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        })
        
        # Enhanced retry strategy for BLS server issues
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        
        retry_strategy = Retry(
            total=5,
            backoff_factor=2,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Add rate limiting
        self.request_delay = 1  # seconds between requests
        self.max_workers = int(os.environ.get('BLS_MAX_WORKERS', '3'))  # Concurrent requests
        self.max_depth = int(os.environ.get('BLS_MAX_DEPTH', '5'))  # Maximum recursion depth
        
    def is_valid_file(self, href: str) -> bool:
        """
        Check if the href points to a valid data file.
        
        Args:
            href: The href attribute from a link
            
        Returns:
            True if it's a valid data file
        """
        # File extensions to include
        valid_extensions = ['.txt', '.csv', '.data', '.xlsx', '.xls', '.json', '.xml', '.tsv']
        
        # Skip parent directory links and non-data files
        if href in ['../', '../', '/', './', '.']:
            return False
            
        # Check for valid file extensions
        return any(href.lower().endswith(ext) for ext in valid_extensions)
    
    def is_valid_directory(self, href: str) -> bool:
        """
        Check if the href points to a valid directory to explore.
        
        Args:
            href: The href attribute from a link
            
        Returns:
            True if it's a valid directory to explore
        """
        # Skip parent directory links, external links, and non-directory patterns
        if href in ['../', '../', '/', './', '.']:
            return False
            
        # Skip external links
        if href.startswith('http://') or href.startswith('https://'):
            if not href.startswith(self.base_url):
                return False
        
        # Directory indicators (ends with slash or no extension)
        return (href.endswith('/') or 
                ('.' not in href.split('/')[-1] and href != '') or
                href.split('/')[-1] in ['data', 'series', 'time'])
    
    def discover_files_recursive(self, url: str, depth: int = 0, relative_path: str = "") -> List[Dict[str, str]]:
        """
        Recursively discover all available files on the BLS website.
        
        Args:
            url: Current URL to explore
            depth: Current recursion depth
            relative_path: Relative path from base URL
            
        Returns:
            List of dictionaries containing file information
        """
        if depth > self.max_depth:
            self.logger.warning(f"Maximum depth {self.max_depth} reached for {url}")
            return []
            
        if url in self.processed_urls:
            return []
            
        with self.lock:
            self.processed_urls.add(url)
        
        self.logger.info(f"Exploring {url} (depth: {depth})")
        
        try:
            # Add delay to be respectful to the server
            time.sleep(self.request_delay)
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            files = []
            subdirs = []
            
            # Find all links
            for link in soup.find_all('a', href=True):
                href = link['href'].strip()
                
                if not href:
                    continue
                
                # Build full URL
                full_url = urljoin(url, href)
                
                # Check if it's a valid file
                if self.is_valid_file(href):
                    file_path = os.path.join(relative_path, href) if relative_path else href
                    file_info = {
                        'name': file_path.replace('\\', '/'),  # Normalize path separators
                        'original_name': href,
                        'url': full_url,
                        'relative_path': relative_path,
                        'size': None,  # We'll get this when downloading
                        'depth': depth
                    }
                    files.append(file_info)
                    self.logger.debug(f"Found file: {file_info['name']}")
                
                # Check if it's a valid directory to explore
                elif self.is_valid_directory(href) and full_url not in self.processed_urls:
                    new_relative_path = os.path.join(relative_path, href.rstrip('/')) if relative_path else href.rstrip('/')
                    subdirs.append((full_url, new_relative_path))
                    self.logger.debug(f"Found directory: {href}")
            
            self.logger.info(f"Found {len(files)} files and {len(subdirs)} subdirectories in {url}")
            
            # Recursively explore subdirectories
            if subdirs and depth < self.max_depth:
                with ThreadPoolExecutor(max_workers=min(self.max_workers, len(subdirs))) as executor:
                    future_to_subdir = {
                        executor.submit(self.discover_files_recursive, subdir_url, depth + 1, subdir_path): 
                        (subdir_url, subdir_path) 
                        for subdir_url, subdir_path in subdirs
                    }
                    
                    for future in as_completed(future_to_subdir):
                        subdir_url, subdir_path = future_to_subdir[future]
                        try:
                            subdir_files = future.result()
                            files.extend(subdir_files)
                        except Exception as e:
                            self.logger.error(f"Error exploring subdirectory {subdir_url}: {e}")
            
            return files
            
        except requests.RequestException as e:
            self.logger.error(f"Failed to discover files from {url}: {e}")
            return []
        except Exception as e:
            self.logger.error(f"Unexpected error discovering files from {url}: {e}")
            return []
    
    def discover_files(self) -> List[Dict[str, str]]:
        """
        Discover all available files on the BLS website recursively.
        
        Returns:
            List of dictionaries containing file information
        """
        self.logger.info(f"Starting recursive file discovery from {self.base_url}")
        
        # Reset discovery state
        self.discovered_files = []
        self.discovered_dirs = set()
        self.processed_urls = set()
        
        # Start recursive discovery
        files = self.discover_files_recursive(self.base_url)
        
        # Remove duplicates based on URL
        unique_files = {}
        for file_info in files:
            if file_info['url'] not in unique_files:
                unique_files[file_info['url']] = file_info
        
        files = list(unique_files.values())
        
        self.logger.info(f"Discovered {len(files)} unique files across all directories")
        return files
    
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
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            # Write file in chunks
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            file_size = os.path.getsize(local_path)
            self.logger.info(f"Downloaded {file_info['name']} ({file_size} bytes)")
            return True
            
        except requests.RequestException as e:
            self.logger.error(f"Failed to download {file_info['name']}: {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error downloading {file_info['name']}: {e}")
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
        
        if s3_etag and s3_etag.strip('"') != local_hash:
            self.logger.info(f"File {file_info['name']} has changed, will upload")
            return True
        
        self.logger.info(f"File {file_info['name']} unchanged, skipping upload")
        return False
    
    def sync_files(self, preserve_directory_structure: bool = False) -> Tuple[int, int]:
        """
        Sync all BLS files to S3.
        
        Returns:
            Tuple of (successful_uploads, total_files)
        """
        # Validate AWS credentials using environment variables
        if not validate_aws_credentials():
            self.logger.error("AWS credentials not configured properly")
            self.logger.info("Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in environment")
            return 0, 0
        
        # Create S3 bucket if it doesn't exist
        if not create_s3_bucket_if_not_exists(self.bucket_name):
            self.logger.error(f"Failed to create/access bucket {self.bucket_name}")
            return 0, 0
        
        # Discover files recursively
        files = self.discover_files()
        if not files:
            self.logger.error("No files discovered")
            return 0, 0
        
        successful_uploads = 0
        skipped_files = 0
        failed_downloads = 0
        failed_uploads = 0
        
        # Create temporary directory for downloads
        with tempfile.TemporaryDirectory() as temp_dir:
            self.logger.info(f"Processing {len(files)} discovered files...")
            
            for i, file_info in enumerate(files, 1):
                try:
                    self.logger.info(f"Processing file {i}/{len(files)}: {file_info['name']}")
                    
                    # Create local file path - either preserve directory structure or flatten
                    if preserve_directory_structure:
                        # Preserve directory structure
                        local_path = os.path.join(temp_dir, file_info['name'])
                        # Ensure directory exists (only if file is in a subdirectory)
                        dir_path = os.path.dirname(local_path)
                        if dir_path != temp_dir:
                            os.makedirs(dir_path, exist_ok=True)
                    else:
                        # Flatten all files to single directory (original behavior)
                        local_filename = file_info['name'].replace('/', '_').replace('\\', '_')
                        local_path = os.path.join(temp_dir, local_filename)
                    
                    # Download file to temp directory
                    if not self.download_file(file_info, local_path):
                        failed_downloads += 1
                        continue
                    
                    # Check if we should upload this file
                    if not self.should_upload_file(file_info, local_path):
                        skipped_files += 1
                        continue
                    
                    # Upload to S3
                    s3_key = f"bls-data/{file_info['name']}"
                    if upload_to_s3(local_path, self.bucket_name, s3_key):
                        successful_uploads += 1
                        self.logger.info(f"Successfully synced {file_info['name']}")
                    else:
                        failed_uploads += 1
                        self.logger.error(f"Failed to upload {file_info['name']}")
                
                except Exception as e:
                    self.logger.error(f"Error processing {file_info['name']}: {e}")
                    failed_uploads += 1
                    continue
        
        # Log comprehensive summary
        self.logger.info("="*50)
        self.logger.info("SYNC SUMMARY")
        self.logger.info("="*50)
        self.logger.info(f"Total files discovered: {len(files)}")
        self.logger.info(f"Files uploaded: {successful_uploads}")
        self.logger.info(f"Files skipped (up to date): {skipped_files}")
        self.logger.info(f"Failed downloads: {failed_downloads}")
        self.logger.info(f"Failed uploads: {failed_uploads}")
        self.logger.info(f"S3 bucket: {self.bucket_name}")
        self.logger.info(f"S3 path: s3://{self.bucket_name}/bls-data/")
        self.logger.info("="*50)
        
        return successful_uploads, len(files)

def load_environment_config():
    """
    Load configuration from environment variables (GitHub repo secrets).
    """
    config = {
        'bucket_name': os.environ.get('BLS_BUCKET_NAME', 'rearc-bls-pr-data'),
        'base_url': os.environ.get('BLS_BASE_URL', 'https://download.bls.gov/pub/time.series/'),
        'target_series': os.environ.get('BLS_TARGET_SERIES', 'pr').split(','),
        'max_workers': int(os.environ.get('BLS_MAX_WORKERS', '3')),
        'max_depth': int(os.environ.get('BLS_MAX_DEPTH', '5')),
        'dry_run': os.environ.get('BLS_DRY_RUN', 'false').lower() == 'true',
        'debug': os.environ.get('BLS_DEBUG', 'false').lower() == 'true',
        'aws_access_key': os.environ.get('AWS_ACCESS_KEY_ID'),
        'aws_secret_key': os.environ.get('AWS_SECRET_ACCESS_KEY'),
        'aws_region': os.environ.get('AWS_REGION', 'us-east-2'),
        'preserve_directory_structure': os.environ.get('BLS_PRESERVE_DIR_STRUCTURE', 'false').lower() == 'true'
    }
    
    return config

def main():
    """
    Main function to run the BLS data sync.
    """
    # Load configuration from environment (GitHub repo secrets)
    config = load_environment_config()
    
    # Set up logging level based on config
    log_level = 'DEBUG' if config.get('debug', False) else 'INFO'
    logger = setup_logging(__name__, log_level)
    
    logger.info("="*50)
    logger.info("BLS DATA SYNCHRONIZATION SCRIPT")
    logger.info("="*50)
    logger.info(f"Bucket: {config['bucket_name']}")
    logger.info(f"AWS Region: {config.get('aws_region', 'us-east-2')}")
    logger.info(f"Base URL: {config['base_url']}")
    logger.info(f"Max Workers: {config['max_workers']}")
    logger.info(f"Max Depth: {config['max_depth']}")
    logger.info(f"Debug Mode: {config.get('debug', False)}")
    logger.info(f"Preserve Directory Structure: {config.get('preserve_directory_structure', False)}")
    logger.info("="*50)
    
    # Validate required environment variables
    if not config.get('aws_access_key') or not config.get('aws_secret_key'):
        logger.error("AWS credentials not found in environment variables")
        logger.error("Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set")
        sys.exit(1)
    
    # Initialize syncer with configuration
    syncer = BLSDataSyncer(
        bucket_name=config['bucket_name'],
        base_url=config['base_url']
    )
    
    # Run sync
    try:
        successful, total = syncer.sync_files(
            preserve_directory_structure=config.get('preserve_directory_structure', False)
        )
        
        print(f"\n🎯 FINAL SYNC SUMMARY:")
        print(f"📊 Total files discovered: {total}")
        print(f"📤 Files uploaded: {successful}")
        print(f"🪣 S3 bucket: {config['bucket_name']}")
        print(f"🔗 S3 path: s3://{config['bucket_name']}/bls-data/")
        print(f"🌐 Source: {config['base_url']}")
        
        if successful > 0:
            print(f"\n✅ Successfully synchronized {successful} files to S3")
        else:
            print(f"\n⚠️  No files were uploaded (all files may already be up to date)")
            
    except KeyboardInterrupt:
        print("\n🛑 Sync interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Sync failed: {e}")
        logger.exception("Detailed error information:")
        sys.exit(1)

if __name__ == "__main__":
    main()