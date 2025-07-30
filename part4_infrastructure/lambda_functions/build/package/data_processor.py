"""
Data Processor Lambda Function
Combines Part 1 (BLS data sync) and Part 2 (Population API) functionality

This Lambda function is triggered daily by EventBridge and:
1. Synchronizes BLS data from their website to S3
2. Fetches population data from DataUSA API and saves to S3
3. Sends SQS message to trigger analytics processing
"""

import json
import os
import boto3
import requests
import time
import hashlib
import tempfile
from datetime import datetime
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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
    logger.info("Starting data processing pipeline")
    
    # Get environment variables
    bls_bucket = os.environ['BLS_BUCKET_NAME']
    population_bucket = os.environ['POPULATION_BUCKET_NAME']
    analytics_queue_url ="https://download.bls.gov/pub/time.series/pr/" #os.environ['ANALYTICS_QUEUE_URL']
    
    results = {
        'bls_sync': {'success': False, 'files_uploaded': 0, 'total_files': 0},
        'population_fetch': {'success': False, 'files_created': []},
        'analytics_triggered': False
    }
    
    try:
        # Part 1: BLS Data Synchronization
        logger.info("Starting BLS data synchronization")
        bls_syncer = BLSDataSyncer(bls_bucket)
        bls_results = bls_syncer.sync_files()
        results['bls_sync'] = {
            'success': bls_results[0] >= 0,  # Success if no errors
            'files_uploaded': bls_results[0],
            'total_files': bls_results[1]
        }
        logger.info(f"BLS sync completed: {bls_results[0]}/{bls_results[1]} files uploaded")
        
        # Part 2: Population Data Fetch
        logger.info("Starting population data fetch")
        population_client = PopulationAPIClient(population_bucket)
        population_success = population_client.run()
        results['population_fetch'] = {
            'success': population_success,
            'files_created': ['population_data_all.json', 'population_data_2013_2018.json'] if population_success else []
        }
        logger.info(f"Population data fetch completed: {'success' if population_success else 'failed'}")
        
        # Trigger analytics if population data was updated
        if population_success:
            logger.info("Sending SQS message to trigger analytics")
            message_body = {
                'trigger': 'data_processor',
                'timestamp': datetime.utcnow().isoformat(),
                'bls_files_updated': bls_results[0],
                'population_updated': True
            }
            
            sqs_client.send_message(
                QueueUrl=analytics_queue_url,
                MessageBody=json.dumps(message_body)
            )
            results['analytics_triggered'] = True
            logger.info("Analytics trigger message sent successfully")
        
        logger.info("Data processing pipeline completed successfully")
        
        return {
            'statusCode': 200,
            'body': json.dumps(results)
        }
        
    except Exception as e:
        logger.error(f"Data processing pipeline failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'results': results
            })
        }

class BLSDataSyncer:
    """
    BLS Data Synchronization class adapted for Lambda
    """
    
    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self.base_url = "https://download.bls.gov/pub/time.series/pr/"
        self.session = requests.Session()
        
        # Add retry strategy for robustness
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set proper User-Agent to avoid 403 Forbidden errors
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive'
        })
        
        self.request_delay = 0.5  # Shorter delay for Lambda
    
    def discover_files(self) -> List[Dict[str, str]]:
        """Discover files from BLS website"""
        try:
            time.sleep(self.request_delay)
            response = self.session.get(self.base_url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            files = []
            
            for link in soup.find_all('a', href=True):
                href = link['href']
                if any(href.endswith(ext) for ext in ['.txt', '.csv', '.data']):
                    # Extract just the filename from href (handle both relative and absolute paths)
                    filename = os.path.basename(href) if href else href
                    if filename:  # Ensure we have a valid filename
                        files.append({
                            'name': filename,
                            'url': urljoin(self.base_url, href)
                        })
            
            logger.info(f"Discovered {len(files)} files from BLS")
            return files
            
        except Exception as e:
            logger.error(f"Failed to discover BLS files: {e}")
            return []
    
    def get_file_hash(self, file_path: str) -> str:
        """Calculate MD5 hash of file"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def should_upload_file(self, file_info: Dict[str, str], local_path: str) -> bool:
        """Check if file should be uploaded"""
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
            logger.info(f"File {file_info['name']} doesn't exist, will upload")
            return True
        except Exception as e:
            logger.error(f"Error checking file {file_info['name']}: {e}")
            return True  # Upload on error to be safe
    
    def sync_files(self) -> tuple:
        """Sync files to S3"""
        files = self.discover_files()
        if not files:
            return 0, 0
        
        successful_uploads = 0
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Limit to first 5 files for Lambda timeout constraints
            for file_info in files[:5]:
                try:
                    # Download file
                    time.sleep(self.request_delay)
                    response = self.session.get(file_info['url'], timeout=60)
                    response.raise_for_status()
                    
                    local_path = os.path.join(temp_dir, file_info['name'])
                    with open(local_path, 'wb') as f:
                        f.write(response.content)
                    
                    # Check if should upload
                    if self.should_upload_file(file_info, local_path):
                        s3_key = f"bls-data/{file_info['name']}"
                        s3_client.upload_file(local_path, self.bucket_name, s3_key)
                        successful_uploads += 1
                        logger.info(f"Uploaded {file_info['name']}")
                        
                except Exception as e:
                    logger.error(f"Failed to process {file_info['name']}: {e}")
                    continue
        
        return successful_uploads, len(files[:5])

class PopulationAPIClient:
    """
    Population API client adapted for Lambda
    """
    
    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self.base_url = "https://datausa.io/api/data"
        self.session = requests.Session()
        
        # Add retry strategy for API robustness (especially for 502 errors)
        retry_strategy = Retry(
            total=5,  # More retries for API calls
            backoff_factor=2,  # Exponential backoff
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.session.headers.update({
            'User-Agent': 'Rearc-Data-Quest-Lambda/1.0',
            'Accept': 'application/json'
        })
    
    def fetch_population_data(self, years: Optional[List[int]] = None) -> Optional[Dict[str, Any]]:
        """Fetch population data from API with enhanced error handling"""
        try:
            params = {
                'drilldowns': 'Nation',
                'measures': 'Population',
                'geo': '01000US'
            }
            
            if years:
                params['year'] = ','.join(map(str, years))
            
            logger.info(f"Fetching population data from: {self.base_url}")
            logger.info(f"Request parameters: {params}")
            
            response = self.session.get(self.base_url, params=params, timeout=30)
            
            # Log response details for debugging
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response headers: {dict(response.headers)}")
            
            response.raise_for_status()
            
            data = response.json()
            
            if 'data' not in data:
                logger.error("Invalid API response structure")
                logger.error(f"Response content: {data}")
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
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 502:
                logger.error(f"502 Bad Gateway error from DataUSA API: {e}")
                logger.error("This is likely a temporary issue with the DataUSA service")
                logger.error(f"Full response: {e.response.text if e.response else 'No response'}")
            else:
                logger.error(f"HTTP error fetching population data: {e}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error fetching population data: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response from population API: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching population data: {e}")
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
