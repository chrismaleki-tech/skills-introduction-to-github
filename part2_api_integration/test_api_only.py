#!/usr/bin/env python3
"""
Test script for API functionality only (without AWS S3)
Tests the DataUSA API with fallback mechanisms.
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
from shared.utils import setup_logging, get_timestamp

class PopulationAPITester:
    """
    Client for testing US population data APIs without S3 integration.
    """
    
    def __init__(self):
        """Initialize the Population API tester."""
        self.logger = setup_logging(__name__)
        
        # Primary API (DataUSA)
        self.datausa_base_url = "https://datausa.io/api/data"
        
        # Fallback API (Census Bureau)
        self.census_base_url = "https://api.census.gov/data"
        self.census_api_key = os.environ.get('CENSUS_API_KEY', '')  # Optional, works without
        
        # Setup session with enhanced retry strategy for server errors
        self.session = requests.Session()
        retry_strategy = Retry(
            total=5,  # Increased retries
            backoff_factor=2,  # Exponential backoff
            status_forcelist=[429, 500, 502, 503, 504],
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
            
            # Check for server errors specifically
            if response.status_code in [502, 503, 504]:
                self.logger.warning(f"DataUSA API returned {response.status_code} (server error). Service may be temporarily unavailable.")
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
    
    def test_apis(self):
        """Test all API endpoints and fallback mechanisms."""
        print("🧪 Testing Population Data APIs")
        print("=" * 50)
        
        # Test 1: DataUSA API directly
        print("\n1. Testing DataUSA API...")
        datausa_data = self.fetch_datausa_population_data([2018, 2019, 2020])
        if datausa_data:
            print(f"✅ DataUSA API: {len(datausa_data['data'])} records retrieved")
            print(f"   Sample: {datausa_data['data'][0] if datausa_data['data'] else 'No data'}")
        else:
            print("❌ DataUSA API: Failed")
        
        # Test 2: Census Bureau API directly
        print("\n2. Testing Census Bureau API...")
        census_data = self.fetch_census_population_data(2018, 2020)
        if census_data:
            print(f"✅ Census Bureau API: {len(census_data['data'])} records retrieved")
            print(f"   Sample: {census_data['data'][0] if census_data['data'] else 'No data'}")
        else:
            print("❌ Census Bureau API: Failed")
        
        # Test 3: Fallback strategy
        print("\n3. Testing fallback strategy...")
        fallback_data = self.fetch_population_data([2013, 2014, 2015])
        if fallback_data:
            source = fallback_data['metadata']['source']
            print(f"✅ Fallback strategy: {len(fallback_data['data'])} records retrieved")
            print(f"   Data source: {source}")
            print(f"   Sample: {fallback_data['data'][0] if fallback_data['data'] else 'No data'}")
        else:
            print("❌ Fallback strategy: Failed")
        
        # Test 4: Mock data generation
        print("\n4. Testing mock data generation...")
        mock_data = self.generate_mock_data(2015, 2017)
        print(f"✅ Mock data: {len(mock_data['data'])} records generated")
        print(f"   Sample: {mock_data['data'][0] if mock_data['data'] else 'No data'}")
        
        print("\n" + "=" * 50)
        print("🏁 API Testing Complete")
        
        # Save results to file for inspection
        results = {
            'datausa_api': datausa_data,
            'census_api': census_data,
            'fallback_data': fallback_data,
            'mock_data': mock_data,
            'test_timestamp': datetime.utcnow().isoformat()
        }
        
        with open('api_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"📁 Test results saved to: api_test_results.json")

def main():
    """Main function to run the API tests."""
    tester = PopulationAPITester()
    tester.test_apis()

if __name__ == "__main__":
    main()