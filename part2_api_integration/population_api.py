#!/usr/bin/env python3
"""
Part 2: API Integration
Population Data API Script

This script fetches US population data from the DataUSA API and saves it to S3 as JSON.
It includes comprehensive error handling, retry logic, and data validation.

API Documentation: https://datausa.io/about/api/
"""

import os
import sys
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Add parent directory to path to import shared utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.utils import (
    setup_logging, create_s3_bucket_if_not_exists, save_json_to_s3, 
    validate_aws_credentials, get_timestamp
)

class PopulationAPIClient:
    """
    Client for fetching US population data from DataUSA API.
    """
    
    def __init__(self, bucket_name: str):
        """
        Initialize the Population API client.
        
        Args:
            bucket_name: S3 bucket name to save data to
        """
        self.bucket_name = bucket_name
        self.logger = setup_logging(__name__)
        self.base_url = "https://datausa.io/api/data"
        
        # Setup session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set proper headers
        self.session.headers.update({
            'User-Agent': 'Rearc-Data-Quest/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
    
    def fetch_population_data(self, years: Optional[List[int]] = None) -> Optional[Dict[str, Any]]:
        """
        Fetch US population data from DataUSA API.
        
        Args:
            years: List of years to fetch data for. If None, fetches all available years.
            
        Returns:
            Population data as dictionary or None if failed
        """
        try:
            # Parameters for the API call
            params = {
                'drilldowns': 'Nation',
                'measures': 'Population',
                'geo': '01000US'  # United States
            }
            
            # Add year filter if specified
            if years:
                params['year'] = ','.join(map(str, years))
            
            self.logger.info(f"Fetching population data from DataUSA API")
            self.logger.info(f"Parameters: {params}")
            
            response = self.session.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Validate response structure
            if 'data' not in data:
                self.logger.error("Invalid API response: missing 'data' field")
                return None
            
            # Add metadata
            enriched_data = {
                'metadata': {
                    'source': 'DataUSA API',
                    'url': response.url,
                    'fetched_at': datetime.utcnow().isoformat(),
                    'total_records': len(data['data']),
                    'api_info': data.get('source', {})
                },
                'data': data['data']
            }
            
            self.logger.info(f"Successfully fetched {len(data['data'])} population records")
            return enriched_data
            
        except requests.RequestException as e:
            self.logger.error(f"Failed to fetch population data: {e}")
            return None
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse API response: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error fetching population data: {e}")
            return None
    
    def fetch_historical_population_data(self, start_year: int = 2013, end_year: int = 2018) -> Optional[Dict[str, Any]]:
        """
        Fetch historical US population data for specific year range.
        
        Args:
            start_year: Starting year (inclusive)
            end_year: Ending year (inclusive)
            
        Returns:
            Population data as dictionary or None if failed
        """
        years = list(range(start_year, end_year + 1))
        return self.fetch_population_data(years)
    
    def validate_population_data(self, data: Dict[str, Any]) -> bool:
        """
        Validate the structure and content of population data.
        
        Args:
            data: Population data dictionary
            
        Returns:
            True if data is valid
        """
        try:
            # Check required fields
            if 'data' not in data or 'metadata' not in data:
                self.logger.error("Missing required fields in population data")
                return False
            
            # Check data records
            records = data['data']
            if not isinstance(records, list) or len(records) == 0:
                self.logger.error("Population data is empty or invalid")
                return False
            
            # Validate each record has required fields
            required_fields = ['Year', 'Population', 'Nation']
            for i, record in enumerate(records):
                for field in required_fields:
                    if field not in record:
                        self.logger.error(f"Record {i} missing required field: {field}")
                        return False
                
                # Validate data types
                try:
                    int(record['Year'])
                    int(record['Population'])
                except (ValueError, TypeError):
                    self.logger.error(f"Record {i} has invalid data types")
                    return False
            
            self.logger.info("Population data validation passed")
            return True
            
        except Exception as e:
            self.logger.error(f"Error validating population data: {e}")
            return False
    
    def save_to_s3(self, data: Dict[str, Any], filename: Optional[str] = None) -> bool:
        """
        Save population data to S3.
        
        Args:
            data: Population data to save
            filename: Optional custom filename
            
        Returns:
            True if save was successful
        """
        if not filename:
            timestamp = get_timestamp()
            filename = f"population_data_{timestamp}.json"
        
        s3_key = f"population-data/{filename}"
        
        return save_json_to_s3(data, self.bucket_name, s3_key)
    
    def run(self) -> bool:
        """
        Run the complete population data fetch and save process.
        
        Returns:
            True if process completed successfully
        """
        # Validate AWS credentials
        if not validate_aws_credentials():
            self.logger.error("AWS credentials not configured properly")
            return False
        
        # Create S3 bucket if it doesn't exist
        if not create_s3_bucket_if_not_exists(self.bucket_name):
            self.logger.error(f"Failed to create/access bucket {self.bucket_name}")
            return False
        
        # Fetch all available population data
        self.logger.info("Fetching all available population data")
        all_data = self.fetch_population_data()
        
        if all_data and self.validate_population_data(all_data):
            if self.save_to_s3(all_data, "population_data_all.json"):
                self.logger.info("Successfully saved all population data to S3")
            else:
                self.logger.error("Failed to save all population data to S3")
                return False
        else:
            self.logger.error("Failed to fetch or validate all population data")
            return False
        
        # Fetch historical data for specific range (2013-2018)
        self.logger.info("Fetching historical population data (2013-2018)")
        historical_data = self.fetch_historical_population_data(2013, 2018)
        
        if historical_data and self.validate_population_data(historical_data):
            if self.save_to_s3(historical_data, "population_data_2013_2018.json"):
                self.logger.info("Successfully saved historical population data to S3")
            else:
                self.logger.error("Failed to save historical population data to S3")
                return False
        else:
            self.logger.error("Failed to fetch or validate historical population data")
            return False
        
        return True

def main():
    """
    Main function to run the population API integration.
    """
    # Configuration
    BUCKET_NAME = os.environ.get('POPULATION_BUCKET_NAME', 'rearc-quest-population-data')
    
    # Initialize client
    client = PopulationAPIClient(BUCKET_NAME)
    
    # Run the process
    try:
        success = client.run()
        
        if success:
            print(f"\n✅ Population data successfully fetched and saved to S3")
            print(f"S3 bucket: {BUCKET_NAME}")
            print(f"S3 path: s3://{BUCKET_NAME}/population-data/")
            print(f"\nFiles created:")
            print(f"  - population_data_all.json (all available years)")
            print(f"  - population_data_2013_2018.json (historical data for analysis)")
        else:
            print(f"\n❌ Failed to fetch or save population data")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Process failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()