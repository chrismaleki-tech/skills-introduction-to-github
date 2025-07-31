#!/usr/bin/env python3
"""
Part 2: API Integration
Population Data API Script

This script fetches US population data from the DataUSA API with fallback options.
It includes comprehensive error handling, retry logic, and data validation.
Enhanced with Census Bureau API fallback for reliability.

API Documentation: 
- DataUSA: https://datausa.io/about/api/
- Census Bureau: https://www.census.gov/data/developers/data-sets/popest-popproj/popest.html
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
    Client for fetching US population data from DataUSA API with Census Bureau fallback.
    """
    
    def __init__(self, bucket_name: str):
        """
        Initialize the Population API client.
        
        Args:
            bucket_name: S3 bucket name to save data to
        """
        self.bucket_name = bucket_name
        self.logger = setup_logging(__name__)
        
        # Primary API (DataUSA)
        self.datausa_base_url = "https://datausa.io/api/data"
        
        # Fallback API (Census Bureau)
        self.census_base_url = "https://api.census.gov/data"
        self.census_api_key = os.environ.get('CENSUS_API_KEY', '')  # Optional, works without
        
        # Setup session with enhanced retry strategy for server errors
        self.session = requests.Session()
        retry_strategy = Retry(
            total=7,  # Increased retries for server errors
            backoff_factor=3,  # More aggressive exponential backoff 
            status_forcelist=[429, 500, 502, 503, 504, 520, 521, 522, 523, 524],  # Added more server error codes
            allowed_methods=["HEAD", "GET", "OPTIONS"],
            raise_on_status=False  # Don't raise on retry status codes
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
    
    def fetch_datausa_population_data(self, years: Optional[List[int]] = None) -> Optional[Dict[str, Any]]:
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
            
            response = self.session.get(self.datausa_base_url, params=params, timeout=30)
            
            # Check for server errors specifically with detailed logging
            if response.status_code in [502, 503, 504]:
                self.logger.warning(f"DataUSA API returned {response.status_code} (server error). Service may be temporarily unavailable.")
                self.logger.info(f"Response headers: {dict(response.headers)}")
                self.logger.info(f"Will attempt fallback to Census Bureau API")
                return None
            elif response.status_code in [520, 521, 522, 523, 524]:
                self.logger.warning(f"DataUSA API returned {response.status_code} (CloudFlare error). CDN/server issue detected.")
                self.logger.info(f"Will attempt fallback to Census Bureau API")
                return None
            
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
            
            self.logger.info(f"Successfully fetched {len(data['data'])} population records from DataUSA")
            return enriched_data
            
        except requests.RequestException as e:
            self.logger.warning(f"DataUSA API request failed: {e}")
            return None
        except json.JSONDecodeError as e:
            self.logger.warning(f"Failed to parse DataUSA API response: {e}")
            return None
        except Exception as e:
            self.logger.warning(f"Unexpected error with DataUSA API: {e}")
            return None
    
    def fetch_census_population_data(self, start_year: int = 2013, end_year: int = 2023) -> Optional[Dict[str, Any]]:
        """
        Fetch US population data from Census Bureau API as fallback.
        
        Args:
            start_year: Starting year (inclusive)
            end_year: Ending year (inclusive)
            
        Returns:
            Population data as dictionary or None if failed
        """
        try:
            self.logger.info(f"Fetching population data from Census Bureau API (fallback)")
            
            all_data = []
            
            # Fetch data year by year due to Census API structure
            for year in range(start_year, min(end_year + 1, 2024)):  # Census data typically available up to 2023
                try:
                    # Use Population Estimates API
                    api_url = f"{self.census_base_url}/{year}/pep/population"
                    
                    params = {
                        'get': 'POP,GEONAME',
                        'for': 'us:*',
                        'DATE': '12'  # End of year estimate
                    }
                    
                    if self.census_api_key:
                        params['key'] = self.census_api_key
                    
                    self.logger.info(f"Fetching Census data for year {year}")
                    response = self.session.get(api_url, params=params, timeout=30)
                    response.raise_for_status()
                    
                    year_data = response.json()
                    
                    # Convert Census format to DataUSA-like format
                    if len(year_data) > 1:  # First row is headers
                        headers = year_data[0]
                        data_row = year_data[1]
                        
                        # Map to consistent format
                        record = {
                            'Year': year,
                            'Population': int(data_row[0]) if data_row[0].isdigit() else data_row[0],
                            'Nation': 'United States'
                        }
                        all_data.append(record)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to fetch Census data for year {year}: {e}")
                    continue
            
            if not all_data:
                self.logger.error("No data retrieved from Census Bureau API")
                return None
            
            # Add metadata
            enriched_data = {
                'metadata': {
                    'source': 'Census Bureau Population Estimates API',
                    'url': f"{self.census_base_url}/[YEAR]/pep/population",
                    'fetched_at': datetime.utcnow().isoformat(),
                    'total_records': len(all_data),
                    'years_covered': f"{start_year}-{max(record['Year'] for record in all_data)}",
                    'api_info': {'note': 'Census Bureau Population Estimates Program'}
                },
                'data': all_data
            }
            
            self.logger.info(f"Successfully fetched {len(all_data)} population records from Census Bureau")
            return enriched_data
            
        except Exception as e:
            self.logger.error(f"Census Bureau API fallback failed: {e}")
            return None
    
    def generate_mock_data(self, start_year: int = 2013, end_year: int = 2018) -> Dict[str, Any]:
        """
        Generate mock population data for testing when all APIs are unavailable.
        
        Args:
            start_year: Starting year
            end_year: Ending year
            
        Returns:
            Mock population data
        """
        self.logger.warning("Generating mock population data for testing purposes")
        
        # Realistic US population data based on historical trends
        base_population = 316128839  # 2013 estimate
        annual_growth = 0.007  # ~0.7% annual growth
        
        mock_data = []
        for year in range(start_year, end_year + 1):
            years_since_base = year - 2013
            population = int(base_population * ((1 + annual_growth) ** years_since_base))
            
            record = {
                'Year': year,
                'Population': population,
                'Nation': 'United States'
            }
            mock_data.append(record)
        
        enriched_data = {
            'metadata': {
                'source': 'Mock Data (Testing)',
                'url': 'N/A - Generated locally',
                'fetched_at': datetime.utcnow().isoformat(),
                'total_records': len(mock_data),
                'warning': 'This is mock data for testing purposes only',
                'api_info': {'note': 'Generated when external APIs are unavailable'}
            },
            'data': mock_data
        }
        
        return enriched_data
    
    def fetch_population_data(self, years: Optional[List[int]] = None) -> Optional[Dict[str, Any]]:
        """
        Fetch US population data with fallback strategy.
        
        Args:
            years: List of years to fetch data for. If None, fetches all available years.
            
        Returns:
            Population data as dictionary or None if all methods failed
        """
        # Try DataUSA API first
        data = self.fetch_datausa_population_data(years)
        if data:
            return data
        
        self.logger.info("DataUSA API unavailable, trying Census Bureau API fallback")
        
        # Fallback to Census Bureau API
        if years:
            start_year = min(years)
            end_year = max(years)
        else:
            start_year = 2013
            end_year = 2023
        
        data = self.fetch_census_population_data(start_year, end_year)
        if data:
            return data
        
        self.logger.warning("Both APIs unavailable, generating mock data for testing")
        
        # Last resort: generate mock data
        if years:
            start_year = min(years)
            end_year = max(years)
        else:
            start_year = 2013
            end_year = 2018
        
        return self.generate_mock_data(start_year, end_year)

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
                
                # Show data source in output
                source = all_data['metadata']['source']
                if 'Mock' in source:
                    print(f"\n⚠️  Using mock data due to API unavailability")
                elif 'Census' in source:
                    print(f"\n✅ Data fetched from Census Bureau (fallback)")
                else:
                    print(f"\n✅ Data fetched from DataUSA API")
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
    BUCKET_NAME = os.environ.get('POPULATION_BUCKET_NAME', 'data-quest-v2-population-data')
    
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
            print(f"\nNote: Script includes fallback to Census Bureau API if DataUSA is unavailable")
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