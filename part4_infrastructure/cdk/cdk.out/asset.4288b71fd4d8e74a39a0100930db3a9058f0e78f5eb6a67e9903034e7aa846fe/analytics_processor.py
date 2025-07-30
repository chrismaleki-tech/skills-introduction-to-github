"""
Analytics Processor Lambda Function
Implements Part 3 analytics functionality

This Lambda function is triggered by SQS messages when new data is available and:
1. Loads BLS and population data from S3
2. Performs the three required analyses
3. Logs the results (as specified in requirements)
"""

import json
import os
import boto3
import pandas as pd
import numpy as np
import io
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')

def lambda_handler(event, context):
    """
    Main Lambda handler for analytics processing
    """
    logger.info("Starting analytics processing")
    
    # Get environment variables
    bls_bucket = os.environ['BLS_BUCKET_NAME']
    population_bucket = os.environ['POPULATION_BUCKET_NAME']
    
    try:
        # Process each SQS message
        for record in event['Records']:
            message_body = json.loads(record['body'])
            logger.info(f"Processing message: {message_body}")
            
            # Initialize analytics processor
            processor = AnalyticsProcessor(bls_bucket, population_bucket)
            
            # Run all analyses
            results = processor.run_all_analyses()
            
            # Log the results as required
            log_analysis_results(results)
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Analytics processing completed successfully'})
        }
        
    except Exception as e:
        logger.error(f"Analytics processing failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def log_analysis_results(results: Dict[str, Any]):
    """
    Log the analysis results in a structured format
    """
    logger.info("=" * 80)
    logger.info("REARC DATA QUEST - ANALYTICS RESULTS")
    logger.info("=" * 80)
    
    # Analysis 1: Population Statistics
    if 'population_stats' in results:
        stats = results['population_stats']
        logger.info("\nANALYSIS 1: US POPULATION STATISTICS (2013-2018)")
        logger.info("-" * 50)
        logger.info(f"Mean Population: {stats.get('mean', 'N/A'):,.0f}")
        logger.info(f"Standard Deviation: {stats.get('std', 'N/A'):,.0f}")
        logger.info(f"Data Points: {stats.get('count', 'N/A')}")
    
    # Analysis 2: Best Year by Series
    if 'best_years' in results:
        best_years = results['best_years']
        logger.info(f"\nANALYSIS 2: BEST YEAR FOR EACH SERIES_ID")
        logger.info("-" * 50)
        logger.info(f"Number of series analyzed: {len(best_years)}")
        
        # Log top 10 series
        logger.info("Top 10 Series by Best Year Value:")
        for i, series in enumerate(best_years[:10]):
            logger.info(f"  {i+1:2d}. series_id: {series['series_id']:15s} | year: {series['year']} | value: {series['value']:10.2f}")
    
    # Analysis 3: Combined Analysis
    if 'combined_analysis' in results:
        combined = results['combined_analysis']
        logger.info(f"\nANALYSIS 3: COMBINED BLS AND POPULATION DATA")
        logger.info("-" * 50)
        logger.info(f"Series ID: PRS30006032, Period: Q01")
        logger.info(f"Records found: {len(combined)}")
        
        if combined:
            logger.info("Sample records:")
            for record in combined[:5]:  # Log first 5 records
                logger.info(f"  Year: {record['year']} | BLS Value: {record['value']} | Population: {record['Population']:,}")
    
    logger.info("=" * 80)

class AnalyticsProcessor:
    """
    Analytics processor for BLS and population data
    """
    
    def __init__(self, bls_bucket: str, population_bucket: str):
        self.bls_bucket = bls_bucket
        self.population_bucket = population_bucket
    
    def load_csv_from_s3(self, bucket: str, key: str) -> Optional[pd.DataFrame]:
        """Load CSV data from S3"""
        try:
            response = s3_client.get_object(Bucket=bucket, Key=key)
            data = response['Body'].read()
            return pd.read_csv(io.BytesIO(data))
        except Exception as e:
            logger.error(f"Failed to load CSV {key} from {bucket}: {e}")
            return None
    
    def load_json_from_s3(self, bucket: str, key: str) -> Optional[Dict[str, Any]]:
        """Load JSON data from S3"""
        try:
            response = s3_client.get_object(Bucket=bucket, Key=key)
            data = response['Body'].read()
            return json.loads(data.decode('utf-8'))
        except Exception as e:
            logger.error(f"Failed to load JSON {key} from {bucket}: {e}")
            return None
    
    def analysis_1_population_stats(self) -> Optional[Dict[str, float]]:
        """
        Analysis 1: Calculate mean and standard deviation of US population (2013-2018)
        """
        logger.info("Running Analysis 1: Population Statistics")
        
        population_json = self.load_json_from_s3(
            self.population_bucket, 
            'population-data/population_data_2013_2018.json'
        )
        
        if not population_json or 'data' not in population_json:
            logger.error("Failed to load population data")
            return None
        
        # Convert to DataFrame
        df = pd.DataFrame(population_json['data'])
        
        # Data cleaning
        df['Year'] = df['Year'].astype(int)
        df['Population'] = df['Population'].astype(int)
        
        # Filter for 2013-2018
        df = df[(df['Year'] >= 2013) & (df['Year'] <= 2018)]
        
        # Calculate statistics
        stats = {
            'mean': float(df['Population'].mean()),
            'std': float(df['Population'].std()),
            'count': len(df),
            'min_year': int(df['Year'].min()),
            'max_year': int(df['Year'].max())
        }
        
        logger.info(f"Population stats calculated: mean={stats['mean']:,.0f}, std={stats['std']:,.0f}")
        return stats
    
    def analysis_2_best_years(self) -> Optional[List[Dict[str, Any]]]:
        """
        Analysis 2: Find the best year for each series_id (max sum of quarterly values)
        """
        logger.info("Running Analysis 2: Best Years by Series")
        
        bls_df = self.load_csv_from_s3(self.bls_bucket, 'bls-data/pr.data.0.Current')
        
        if bls_df is None:
            logger.error("Failed to load BLS data")
            return None
        
        # Data cleaning
        for col in bls_df.select_dtypes(include=['object']).columns:
            bls_df[col] = bls_df[col].astype(str).str.strip()
        
        bls_df['year'] = pd.to_numeric(bls_df['year'], errors='coerce')
        bls_df['value'] = pd.to_numeric(bls_df['value'], errors='coerce')
        
        # Filter for quarterly data
        quarterly_df = bls_df[bls_df['period'].isin(['Q01', 'Q02', 'Q03', 'Q04'])].copy()
        quarterly_df = quarterly_df.dropna(subset=['series_id', 'year', 'value'])
        
        if quarterly_df.empty:
            logger.error("No quarterly data found")
            return None
        
        # Group by series_id and year, sum quarterly values
        yearly_sums = quarterly_df.groupby(['series_id', 'year'])['value'].sum().reset_index()
        yearly_sums.columns = ['series_id', 'year', 'value']
        
        # Find best year for each series
        best_years = yearly_sums.loc[yearly_sums.groupby('series_id')['value'].idxmax()]
        
        # Convert to list of dictionaries and sort by value (descending)
        results = best_years.to_dict('records')
        results.sort(key=lambda x: x['value'], reverse=True)
        
        logger.info(f"Best years calculated for {len(results)} series")
        return results
    
    def analysis_3_combined_data(self) -> Optional[List[Dict[str, Any]]]:
        """
        Analysis 3: Combine BLS series PRS30006032 (Q01) with population data
        """
        logger.info("Running Analysis 3: Combined BLS and Population Data")
        
        # Load BLS data
        bls_df = self.load_csv_from_s3(self.bls_bucket, 'bls-data/pr.data.0.Current')
        if bls_df is None:
            logger.error("Failed to load BLS data")
            return None
        
        # Load population data
        population_json = self.load_json_from_s3(
            self.population_bucket, 
            'population-data/population_data_all.json'
        )
        if not population_json or 'data' not in population_json:
            logger.error("Failed to load population data")
            return None
        
        # Data cleaning for BLS
        for col in bls_df.select_dtypes(include=['object']).columns:
            bls_df[col] = bls_df[col].astype(str).str.strip()
        
        bls_df['year'] = pd.to_numeric(bls_df['year'], errors='coerce')
        bls_df['value'] = pd.to_numeric(bls_df['value'], errors='coerce')
        
        # Filter BLS data for specific series and period
        target_series = 'PRS30006032'
        target_period = 'Q01'
        
        filtered_bls = bls_df[
            (bls_df['series_id'] == target_series) & 
            (bls_df['period'] == target_period)
        ].copy()
        
        if filtered_bls.empty:
            logger.warning(f"No data found for series {target_series}, period {target_period}")
            return []
        
        # Convert population data to DataFrame
        population_df = pd.DataFrame(population_json['data'])
        population_df['Year'] = population_df['Year'].astype(int)
        population_df['Population'] = population_df['Population'].astype(int)
        
        # Merge datasets
        merged_df = filtered_bls.merge(
            population_df[['Year', 'Population']], 
            left_on='year', 
            right_on='Year', 
            how='inner'
        )
        
        # Select relevant columns and convert to list of dictionaries
        result_df = merged_df[['series_id', 'year', 'period', 'value', 'Population']].copy()
        results = result_df.to_dict('records')
        
        logger.info(f"Combined analysis found {len(results)} matching records")
        return results
    
    def run_all_analyses(self) -> Dict[str, Any]:
        """
        Run all three analyses and return results
        """
        results = {}
        
        try:
            # Analysis 1: Population Statistics
            population_stats = self.analysis_1_population_stats()
            if population_stats:
                results['population_stats'] = population_stats
            
            # Analysis 2: Best Years
            best_years = self.analysis_2_best_years()
            if best_years:
                results['best_years'] = best_years
            
            # Analysis 3: Combined Analysis
            combined_analysis = self.analysis_3_combined_data()
            if combined_analysis is not None:
                results['combined_analysis'] = combined_analysis
            
            logger.info("All analyses completed successfully")
            
        except Exception as e:
            logger.error(f"Error during analysis execution: {e}")
            results['error'] = str(e)
        
        return results