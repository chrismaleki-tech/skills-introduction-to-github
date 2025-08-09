"""
Data Processor Lambda Function
Combines Part 1 (BLS data sync) and Part 2 (Population API) functionality

This Lambda function is triggered daily by EventBridge and:
1. Synchronizes BLS data from their website to S3 with RECURSIVE CRAWLING
2. Fetches population data from DataUSA API and saves to S3
3. Sends SQS message to trigger analytics processing

Enhanced with comprehensive recursive directory traversal and file discovery.
"""

import json
import os
import boto3
import requests
import time
import hashlib
import tempfile
from datetime import datetime
from typing import Dict, List, Any, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')

def lambda_handler(event, context):
    """
    Main Lambda handler that orchestrates data processing
    """
    logger.info("Starting enhanced data processing pipeline with recursive crawling")
    
    # Get environment variables
    bls_bucket = os.environ['BLS_BUCKET_NAME']
    population_bucket = os.environ['POPULATION_BUCKET_NAME']
    # cursor/fix-bls-and-population-api-errors-5304
    analytics_queue_url = os.environ['ANALYTICS_QUEUE_URL']

    
    # Get Lambda-specific configuration
    max_execution_time = int(os.environ.get('LAMBDA_MAX_EXECUTION_TIME', '840'))  # 14 minutes (900s - 60s buffer)
    max_depth = int(os.environ.get('BLS_MAX_DEPTH', '3'))  # Limit recursion depth for Lambda
    max_workers = int(os.environ.get('BLS_MAX_WORKERS', '5'))  # Concurrent requests
main
    
    results = {
        'bls_sync': {'success': False, 'files_uploaded': 0, 'total_files': 0, 'directories_explored': 0},
        'population_fetch': {'success': False, 'files_created': []},
        'analytics_triggered': False,
        'execution_time_seconds': 0
    }
    
    start_time = time.time()
    
    try:
        # Part 1: Enhanced BLS Data Synchronization with Recursive Crawling
        logger.info("Starting enhanced BLS data synchronization with recursive crawling")
        bls_syncer = EnhancedBLSDataSyncer(
            bls_bucket, 
            max_depth=max_depth, 
            max_workers=max_workers,
            max_execution_time=max_execution_time
        )
        bls_results = bls_syncer.sync_files_recursive()
        results['bls_sync'] = {
            'success': bls_results[0] >= 0,  # Success if no errors
            'files_uploaded': bls_results[0],
            'total_files': bls_results[1],
            'directories_explored': bls_results[2]
        }
        logger.info(f"Enhanced BLS sync completed: {bls_results[0]}/{bls_results[1]} files uploaded from {bls_results[2]} directories")
        
        # Check remaining execution time
        elapsed_time = time.time() - start_time
        remaining_time = max_execution_time - elapsed_time
        
        if remaining_time > 60:  # Only proceed if we have at least 60 seconds left
            # Part 2: Population Data Fetch
            logger.info("Starting population data fetch")
            population_client = PopulationAPIClient(population_bucket)
            population_success = population_client.run()
            results['population_fetch'] = {
                'success': population_success,
                'files_created': ['population_data_all.json', 'population_data_2013_2018.json'] if population_success else []
            }
            logger.info(f"Population data fetch completed: {'success' if population_success else 'failed'}")
            
            # Trigger analytics if any data was updated
            if bls_results[0] > 0 or population_success:
                if analytics_queue_url:
                    logger.info("Sending SQS message to trigger analytics")
                    message_body = {
                        'trigger': 'enhanced_data_processor',
                        'timestamp': datetime.utcnow().isoformat(),
                        'bls_files_updated': bls_results[0],
                        'bls_directories_explored': bls_results[2],
                        'population_updated': population_success
                    }
                    
                    sqs_client.send_message(
                        QueueUrl=analytics_queue_url,
                        MessageBody=json.dumps(message_body)
                    )
                    results['analytics_triggered'] = True
                    logger.info("Analytics trigger message sent successfully")
        else:
            logger.warning(f"Skipping population fetch - insufficient time remaining: {remaining_time:.1f}s")
        
        results['execution_time_seconds'] = time.time() - start_time
        logger.info(f"Enhanced data processing pipeline completed successfully in {results['execution_time_seconds']:.1f} seconds")
        
        return {
            'statusCode': 200,
            'body': json.dumps(results)
        }
        
    except Exception as e:
        results['execution_time_seconds'] = time.time() - start_time
        logger.error(f"Enhanced data processing pipeline failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'results': results
            })
        }

class EnhancedBLSDataSyncer:
    """
    Enhanced BLS Data Synchronization class with comprehensive recursive crawling
    """
    
    def __init__(self, bucket_name: str, max_depth: int = 3, max_workers: int = 5, max_execution_time: int = 840):
        self.bucket_name = bucket_name
        self.base_url = "https://download.bls.gov/pub/time.series/"
        self.session = requests.Session()
        self.max_depth = max_depth
        self.max_workers = max_workers
        self.max_execution_time = max_execution_time
        self.start_time = time.time()
        
        # Thread-safe collections for recursive discovery
        self.discovered_files = []
        self.discovered_directories = set()
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
            'Cache-Control': 'max-age=0'
        })
        
        self.request_delay = 0.3  # Reduced delay for Lambda efficiency
    
    def is_valid_file(self, href: str) -> bool:
        """
        Check if the href points to a valid BLS data file
        """
        # BLS file extensions and patterns
        valid_extensions = ['.txt', '.csv', '.data', '.xlsx', '.xls', '.json', '.xml', '.tsv', '.series', '.notes']
        
        # Skip parent directory links and non-data files
        if href in ['../', '../', '/', './', '.', '']:
            return False
            
        # Skip external links
        if href.startswith('http://') or href.startswith('https://'):
            if not href.startswith(self.base_url):
                return False
        
        # Check for valid file extensions or BLS-specific patterns
        href_lower = href.lower()
        return (any(href_lower.endswith(ext) for ext in valid_extensions) or
                any(pattern in href_lower for pattern in ['pr.data', 'pr.series', 'pr.notes']))
    
    def is_valid_directory(self, href: str) -> bool:
        """
        Check if the href points to a valid directory to explore
        """
        # Skip parent directory links, external links, and non-directory patterns
        if href in ['../', '../', '/', './', '.', '']:
            return False
            
        # Skip external links
        if href.startswith('http://') or href.startswith('https://'):
            if not href.startswith(self.base_url):
                return False
        
        # Directory indicators - ends with slash or single letter directories (a/, b/, z/, etc.)
        return (href.endswith('/') or 
                (len(href.rstrip('/')) == 1 and href.rstrip('/').isalpha()) or
                href.rstrip('/') in ['data', 'series', 'time', 'Current'])
    
    def check_execution_time(self) -> bool:
        """Check if we still have time to continue execution"""
        elapsed = time.time() - self.start_time
        return elapsed < (self.max_execution_time - 60)  # Keep 60s buffer
    
    def discover_files_recursive(self, url: str, depth: int = 0, relative_path: str = "") -> List[Dict[str, str]]:
        """
        Recursively discover all available files in the BLS directory structure
        """
        if depth > self.max_depth or not self.check_execution_time():
            if depth > self.max_depth:
                logger.warning(f"Maximum depth {self.max_depth} reached for {url}")
            else:
                logger.warning(f"Execution time limit approaching, stopping recursion at {url}")
            return []
            
        if url in self.processed_urls:
            return []
            
        with self.lock:
            self.processed_urls.add(url)
            self.discovered_directories.add(url)
        
        logger.info(f"Exploring {url} (depth: {depth})")
        
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
                        'depth': depth
                    }
                    files.append(file_info)
                    logger.debug(f"Found file: {file_info['name']}")
                
                # Check if it's a valid directory to explore
                elif self.is_valid_directory(href) and full_url not in self.processed_urls:
                    new_relative_path = os.path.join(relative_path, href.rstrip('/')) if relative_path else href.rstrip('/')
                    subdirs.append((full_url, new_relative_path))
                    logger.debug(f"Found directory: {href}")
            
            logger.info(f"Found {len(files)} files and {len(subdirs)} subdirectories in {url}")
            
            # Recursively explore subdirectories with concurrency
            if subdirs and depth < self.max_depth and self.check_execution_time():
                # Limit concurrent workers based on remaining subdirs and max_workers
                actual_workers = min(self.max_workers, len(subdirs), 3)  # Cap at 3 for Lambda
                
                with ThreadPoolExecutor(max_workers=actual_workers) as executor:
                    future_to_subdir = {
                        executor.submit(self.discover_files_recursive, subdir_url, depth + 1, subdir_path): 
                        (subdir_url, subdir_path) 
                        for subdir_url, subdir_path in subdirs
                    }
                    
                    for future in as_completed(future_to_subdir):
                        if not self.check_execution_time():
                            logger.warning("Execution time limit approaching, cancelling remaining subdirectory exploration")
                            break
                            
                        subdir_url, subdir_path = future_to_subdir[future]
                        try:
                            subdir_files = future.result(timeout=30)
                            files.extend(subdir_files)
                        except Exception as e:
                            logger.error(f"Error exploring subdirectory {subdir_url}: {e}")
            
            return files
            
        except requests.RequestException as e:
            logger.error(f"Failed to discover files from {url}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error discovering files from {url}: {e}")
            return []
    
    def discover_all_files(self) -> List[Dict[str, str]]:
        """
        Discover all available files on the BLS website recursively
        """
        logger.info(f"Starting comprehensive recursive file discovery from {self.base_url}")
        
        # Reset discovery state
        self.discovered_files = []
        self.discovered_directories = set()
        self.processed_urls = set()
        
        # Start recursive discovery
        files = self.discover_files_recursive(self.base_url)
        
        # Remove duplicates based on URL
        unique_files = {}
        for file_info in files:
            if file_info['url'] not in unique_files:
                unique_files[file_info['url']] = file_info
        
        files = list(unique_files.values())
        
        logger.info(f"Discovered {len(files)} unique files across {len(self.discovered_directories)} directories")
        return files
    
    def get_file_hash(self, file_path: str) -> str:
        """Calculate MD5 hash of file"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def should_upload_file(self, file_info: Dict[str, str], local_path: str) -> bool:
        """Check if file should be uploaded to S3"""
        s3_key = f"bls-data/{file_info['name']}"
        
        try:
            s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            # File exists, check if changed
            local_hash = self.get_file_hash(local_path)
            response = s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            s3_etag = response['ETag'].strip('"')
            
            if s3_etag != local_hash:
                logger.info(f"File {file_info['name']} has changed, will upload")
                return True
            else:
                logger.info(f"File {file_info['name']} unchanged, skipping")
                return False
                
        except s3_client.exceptions.NoSuchKey:
            logger.info(f"File {file_info['name']} doesn't exist in S3, will upload")
            return True
        except Exception as e:
            logger.error(f"Error checking file {file_info['name']}: {e}")
            return True  # Upload on error to be safe
    
    def sync_files_recursive(self) -> Tuple[int, int, int]:
        """
        Sync files to S3 with comprehensive recursive discovery
        Returns: (successful_uploads, total_files, directories_explored)
        """
        # Discover all files recursively
        files = self.discover_all_files()
        directories_explored = len(self.discovered_directories)
        
        if not files:
            logger.warning("No files discovered during recursive crawling")
            return 0, 0, directories_explored
        
        successful_uploads = 0
        processed_files = 0
        max_files_for_lambda = 50  # Reasonable limit for Lambda execution
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Process files with execution time awareness
            for file_info in files[:max_files_for_lambda]:
                if not self.check_execution_time():
                    logger.warning(f"Execution time limit approaching, stopping at {processed_files} files")
                    break
                    
                try:
                    processed_files += 1
                    logger.info(f"Processing file {processed_files}/{min(len(files), max_files_for_lambda)}: {file_info['name']}")
                    
                    # Download file
                    time.sleep(self.request_delay)
                    response = self.session.get(file_info['url'], timeout=60)
                    response.raise_for_status()
                    
                    # Save to temp file with safe filename
                    safe_filename = file_info['name'].replace('/', '_').replace('\\', '_')
                    local_path = os.path.join(temp_dir, safe_filename)
                    with open(local_path, 'wb') as f:
                        f.write(response.content)
                    
                    # Check if should upload
                    if self.should_upload_file(file_info, local_path):
                        s3_key = f"bls-data/{file_info['name']}"
                        s3_client.upload_file(local_path, self.bucket_name, s3_key)
                        successful_uploads += 1
                        logger.info(f"Successfully uploaded {file_info['name']}")
                        
                except Exception as e:
                    logger.error(f"Failed to process {file_info['name']}: {e}")
                    continue
        
        logger.info(f"Recursive sync completed: {successful_uploads} uploads from {processed_files} processed files across {directories_explored} directories")
        return successful_uploads, processed_files, directories_explored

class PopulationAPIClient:
    """
    Population API client adapted for Lambda
    """
    
    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self.base_url = "https://datausa.io/api/data"
        self.session = requests.Session()
        
        # Enhanced retry strategy for server errors
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        
        retry_strategy = Retry(
            total=7,  # Increased retries for server errors
            backoff_factor=3,  # More aggressive exponential backoff
            status_forcelist=[429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
            allowed_methods=["HEAD", "GET", "OPTIONS"],
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.session.headers.update({
            'User-Agent': 'Rearc-Data-Quest-Lambda/1.0',
            'Accept': 'application/json'
        })
    
    def fetch_population_data(self, years: Optional[List[int]] = None) -> Optional[Dict[str, Any]]:
        """Fetch population data from API"""
        try:
            params = {
                'drilldowns': 'Nation',
                'measures': 'Population',
                'geo': '01000US'
            }
            
            if years:
                params['year'] = ','.join(map(str, years))
            
            response = self.session.get(self.base_url, params=params, timeout=30)
            
            # Enhanced error handling for server errors
            if response.status_code in [502, 503, 504]:
                logger.warning(f"DataUSA API returned {response.status_code} (server error). Service may be temporarily unavailable.")
                logger.info(f"Response headers: {dict(response.headers)}")
                return None
            elif response.status_code in [520, 521, 522, 523, 524]:
                logger.warning(f"DataUSA API returned {response.status_code} (CloudFlare error). CDN/server issue detected.")
                return None
            
            response.raise_for_status()
            
            data = response.json()
            
            if 'data' not in data:
                logger.error("Invalid API response structure")
                return None
            
            enriched_data = {
                'metadata': {
                    'source': 'DataUSA API',
                    'url': response.url,
                    'fetched_at': datetime.utcnow().isoformat(),
                    'total_records': len(data['data'])
                },
                'data': data['data']
            }
            
            logger.info(f"Fetched {len(data['data'])} population records")
            return enriched_data
            
        except Exception as e:
            logger.error(f"Failed to fetch population data: {e}")
            return None
    
    def save_to_s3(self, data: Dict[str, Any], filename: str) -> bool:
        """Save data to S3"""
        try:
            s3_key = f"population-data/{filename}"
            json_string = json.dumps(data, indent=2, default=str)
            
            s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=json_string,
                ContentType='application/json'
            )
            
            logger.info(f"Saved {filename} to S3")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save {filename}: {e}")
            return False
    
    def run(self) -> bool:
        """Run population data fetch process"""
        try:
            # Fetch all available data
            all_data = self.fetch_population_data()
            if not all_data:
                return False
            
            # Fetch 2013-2018 data
            historical_data = self.fetch_population_data(list(range(2013, 2019)))
            if not historical_data:
                return False
            
            # Save both datasets
            success1 = self.save_to_s3(all_data, "population_data_all.json")
            success2 = self.save_to_s3(historical_data, "population_data_2013_2018.json")
            
            return success1 and success2
            
        except Exception as e:
            logger.error(f"Population data fetch failed: {e}")
            return False
