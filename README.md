# Rearc Data Quest - Complete End-to-End Solution

A comprehensive data engineering solution showcasing data management, AWS services, analytics, and infrastructure-as-code skills.

## Overview

This project implements a complete data pipeline architecture with 4 main components:

1. **AWS S3 & Data Sourcing**: Automated sync of BLS (Bureau of Labor Statistics) datasets to S3
2. **API Integration**: Population data fetching from DataUSA API
3. **Data Analytics**: Statistical analysis and reporting using Python/Pandas
4. **Infrastructure as Code**: Automated AWS pipeline using CDK/CloudFormation

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BLS Dataset   │    │  DataUSA API    │    │    AWS S3       │
│   (Source)      │───▶│   (Source)      │───▶│   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                              ┌─────────────────┐
                                              │   Lambda        │
                                              │ (Processing)    │
                                              └─────────────────┘
                                                       │
                                              ┌─────────────────┐
                                              │     SQS         │
                                              │   (Queue)       │
                                              └─────────────────┘
                                                       │
                                              ┌─────────────────┐
                                              │   Analytics     │
                                              │   Lambda        │
                                              └─────────────────┘
```

## Project Structure

```
rearc-data-quest/
├── part1_data_sourcing/
│   ├── bls_data_sync.py
│   └── requirements.txt
├── part2_api_integration/
│   ├── population_api.py
│   └── requirements.txt
├── part3_analytics/
│   ├── data_analysis.ipynb
│   └── requirements.txt
├── part4_infrastructure/
│   ├── cdk/
│   │   ├── app.py
│   │   ├── pipeline_stack.py
│   │   └── requirements.txt
│   └── lambda_functions/
│       ├── data_processor.py
│       └── analytics_processor.py
├── shared/
│   └── utils.py
├── requirements.txt
└── README.md
```

## Quick Start

### Prerequisites

- Python 3.9+
- AWS CLI configured with appropriate permissions
- AWS CDK installed (for Part 4)
- Jupyter Notebook (for Part 3)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd rearc-data-quest

# Install dependencies
pip install -r requirements.txt

# Set up AWS credentials
aws configure
```

### Running Each Part

#### Part 1: Data Sourcing
```bash
cd part1_data_sourcing
python bls_data_sync.py
```

#### Part 2: API Integration
```bash
cd part2_api_integration
python population_api.py
```

#### Part 3: Analytics
```bash
cd part3_analytics
jupyter notebook data_analysis.ipynb
```

#### Part 4: Infrastructure Deployment
```bash
cd part4_infrastructure/cdk
cdk deploy
```

## Features

### Part 1: BLS Data Synchronization
- **Smart Sync**: Only uploads new or changed files
- **Dynamic Discovery**: Automatically handles added/removed files
- **Error Handling**: Robust handling of 403 Forbidden errors with proper User-Agent headers
- **Incremental Updates**: Efficient delta synchronization

### Part 2: Population API Integration
- **DataUSA API**: Fetches US population data
- **JSON Storage**: Saves results to S3 in structured format
- **Error Handling**: Comprehensive API error handling and retries

### Part 3: Data Analytics
- **Statistical Analysis**: Mean and standard deviation calculations
- **Time Series Analysis**: Best year identification by series
- **Data Joining**: Cross-dataset analysis and reporting
- **Data Cleaning**: Handles whitespace and format inconsistencies

### Part 4: Infrastructure as Code
- **AWS CDK**: Complete infrastructure deployment
- **Lambda Functions**: Automated data processing
- **SQS Integration**: Event-driven analytics
- **CloudWatch**: Monitoring and logging
- **S3 Notifications**: Automatic triggering

## Key Technologies

- **Languages**: Python 3.9+
- **Analytics**: Pandas, NumPy, Jupyter
- **AWS Services**: S3, Lambda, SQS, CloudWatch
- **Infrastructure**: AWS CDK, CloudFormation
- **Data Formats**: CSV, JSON
- **APIs**: REST, DataUSA API

## Data Sources

1. **BLS Dataset**: Bureau of Labor Statistics time-series data
   - URL: https://download.bls.gov/pub/time.series/pr/
   - Format: CSV files
   - Content: Labor productivity data

2. **DataUSA Population API**: US demographic data
   - URL: https://datausa.io/api/
   - Format: JSON
   - Content: Annual US population statistics

## Results and Deliverables

### Part 1 Deliverables
- ✅ S3 bucket with synchronized BLS data
- ✅ Automated sync script with delta updates
- ✅ Source code with comprehensive error handling

### Part 2 Deliverables  
- ✅ Population data JSON files in S3
- ✅ API integration script with retry logic
- ✅ Source code with documentation

### Part 3 Deliverables
- ✅ Jupyter notebook with complete analysis
- ✅ Statistical reports (mean, std deviation)
- ✅ Best year analysis by series
- ✅ Combined dataset insights

### Part 4 Deliverables
- ✅ Complete CDK infrastructure code
- ✅ Automated Lambda pipeline
- ✅ SQS-triggered analytics
- ✅ Monitoring and logging setup

## Security & Best Practices

- **IAM Roles**: Least-privilege access patterns
- **Environment Variables**: Secure configuration management
- **Error Handling**: Comprehensive logging and monitoring
- **Data Validation**: Input sanitization and format validation
- **Cost Optimization**: Efficient resource usage

## Monitoring & Observability

- **CloudWatch Logs**: Centralized logging
- **Metrics**: Custom metrics for data pipeline health
- **Alarms**: Automated failure notifications
- **Dashboards**: Real-time pipeline monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or support, please contact [tsylanasotad@outlook.com]
