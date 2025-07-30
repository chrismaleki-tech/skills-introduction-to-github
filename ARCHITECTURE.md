# Rearc Data Quest - Architecture Documentation

## Overview

The Rearc Data Quest solution implements a comprehensive data pipeline architecture that demonstrates modern data engineering practices, cloud-native design patterns, and automated analytics workflows.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            REARC DATA QUEST ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────────┘

 External Data Sources              AWS Cloud Infrastructure
┌─────────────────────┐            ┌─────────────────────────────────────────────┐
│                     │            │                                             │
│  BLS Website        │            │  ┌─────────────────┐    ┌─────────────────┐ │
│  (Labor Statistics) │ ──────────▶│  │   Data          │    │   Analytics     │ │
│                     │            │  │   Processor     │    │   Processor     │ │
└─────────────────────┘            │  │   Lambda        │    │   Lambda        │ │
                                   │  └─────────────────┘    └─────────────────┘ │
┌─────────────────────┐            │           │                       ▲         │
│                     │            │           ▼                       │         │
│  DataUSA API        │ ──────────▶│  ┌─────────────────┐    ┌─────────────────┐ │
│  (Population Data)  │            │  │                 │    │                 │ │
│                     │            │  │   S3 Buckets    │    │   SQS Queue     │ │
└─────────────────────┘            │  │   - BLS Data    │    │   - Analytics   │ │
                                   │  │   - Population  │    │   - Dead Letter │ │
                                   │  │                 │    │                 │ │
┌─────────────────────┐            │  └─────────────────┘    └─────────────────┘ │
│                     │            │           │                       │         │
│  EventBridge        │ ──────────▶│           │              S3 Event │         │
│  (Daily Schedule)   │            │           │              Notification      │ │
│                     │            │           ▼                       │         │
└─────────────────────┘            │  ┌─────────────────┐              │         │
                                   │  │                 │              │         │
                                   │  │  CloudWatch     │◀─────────────┘         │
                                   │  │  Logs & Metrics │                       │
                                   │  │                 │                       │
                                   │  └─────────────────┘                       │
                                   │                                             │
                                   └─────────────────────────────────────────────┘
```

## Component Architecture

### 1. Data Ingestion Layer

#### BLS Data Synchronization
- **Source**: Bureau of Labor Statistics website
- **Method**: Web scraping with HTML parsing
- **Frequency**: Daily, scheduled via EventBridge
- **Storage**: S3 bucket (`rearc-quest-bls-data`)
- **Features**:
  - Smart sync (only uploads changed files)
  - ETag-based change detection
  - Rate limiting to respect server resources
  - User-Agent spoofing to avoid 403 errors

#### Population Data API Integration
- **Source**: DataUSA API
- **Method**: RESTful API calls
- **Frequency**: Daily, triggered with BLS sync
- **Storage**: S3 bucket (`rearc-quest-population-data`)
- **Features**:
  - Retry logic with exponential backoff
  - Data validation and enrichment
  - Metadata tracking
  - Multiple dataset versions (all years, 2013-2018)

### 2. Processing Layer

#### Data Processor Lambda Function
- **Runtime**: Python 3.9
- **Memory**: 512 MB
- **Timeout**: 15 minutes
- **Triggers**: EventBridge (daily schedule)
- **Functions**:
  - Orchestrates both BLS and Population data collection
  - Implements Parts 1 & 2 functionality
  - Sends SQS messages to trigger analytics
  - Comprehensive error handling and logging

#### Analytics Processor Lambda Function
- **Runtime**: Python 3.9
- **Memory**: 1024 MB
- **Timeout**: 5 minutes
- **Triggers**: SQS messages
- **Functions**:
  - Implements Part 3 analytics functionality
  - Calculates population statistics (mean, std dev)
  - Finds best performing years by series
  - Performs cross-dataset analysis
  - Logs results to CloudWatch

### 3. Storage Layer

#### S3 Bucket Design

```
rearc-quest-bls-data/
├── bls-data/
│   ├── pr.data.0.Current
│   ├── pr.data.1.AllData
│   ├── pr.series
│   └── [other BLS files]

rearc-quest-population-data/
├── population-data/
│   ├── population_data_all.json
│   ├── population_data_2013_2018.json
│   └── population_data_[timestamp].json
```

**Security Features**:
- Public access blocked
- Versioning enabled
- Server-side encryption
- IAM-based access control

### 4. Event-Driven Architecture

#### EventBridge (CloudWatch Events)
- **Schedule**: Daily at 6:00 AM UTC
- **Target**: Data Processor Lambda
- **Rule**: Cron expression `0 6 * * ? *`

#### SQS Integration
- **Queue**: Analytics processing queue
- **Dead Letter Queue**: Failed message handling
- **Visibility Timeout**: 6 minutes (Lambda timeout + buffer)
- **Message Retention**: 14 days
- **Triggers**: S3 object creation events

#### S3 Event Notifications
- **Trigger**: Object creation in population bucket
- **Filter**: `.json` files only
- **Destination**: SQS queue
- **Purpose**: Event-driven analytics processing

### 5. Monitoring and Observability

#### CloudWatch Integration
- **Logs**: Structured logging from all Lambda functions
- **Metrics**: Custom metrics for data pipeline health
- **Alarms**: Automated failure notifications
- **Dashboards**: Real-time pipeline monitoring

#### Logging Strategy
```python
# Structured logging format
{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "INFO",
    "component": "bls-syncer",
    "message": "File uploaded successfully",
    "metadata": {
        "file_name": "pr.data.0.Current",
        "file_size": 1024000,
        "bucket": "rearc-quest-bls-data"
    }
}
```

## Data Flow

### 1. Daily Data Pipeline
```
EventBridge Timer → Data Processor Lambda → BLS Sync + API Fetch → S3 Storage → SQS Message → Analytics Lambda → CloudWatch Logs
```

### 2. Event-Driven Analytics
```
S3 Object Creation → S3 Event Notification → SQS Queue → Analytics Lambda → Analysis Execution → Results Logging
```

### 3. Error Handling Flow
```
Lambda Error → CloudWatch Logs → Dead Letter Queue (if SQS) → Manual Investigation
```

## Security Architecture

### Identity and Access Management (IAM)

#### Data Processor Role Permissions
- S3: Read/Write access to both buckets
- SQS: Send messages to analytics queue
- CloudWatch: Logs creation and metrics
- No external internet restrictions (needs to access BLS/DataUSA)

#### Analytics Processor Role Permissions
- S3: Read-only access to both buckets
- SQS: Consume messages from analytics queue
- CloudWatch: Logs creation and metrics
- No external internet access required

### Network Security
- Lambda functions run in AWS managed VPC
- S3 buckets with private access only
- No public endpoints exposed
- VPC endpoints available for enhanced security

### Data Encryption
- **In Transit**: HTTPS for all API calls, TLS for AWS service communication
- **At Rest**: S3 server-side encryption (SSE-S3)
- **Processing**: Temporary files in Lambda are ephemeral

## Scalability Considerations

### Horizontal Scaling
- Lambda functions auto-scale based on demand
- SQS supports high throughput message processing
- S3 provides unlimited storage capacity

### Vertical Scaling
- Lambda memory can be increased for processing efficiency
- Timeout values adjustable for long-running operations
- Concurrent execution limits configurable

### Performance Optimization
- ETag-based change detection reduces unnecessary transfers
- Streaming uploads for large files
- Batch processing for multiple SQS messages
- Connection pooling for HTTP requests

## Cost Optimization

### AWS Service Costs
- **Lambda**: Pay-per-execution model
- **S3**: Storage costs optimized with Intelligent Tiering
- **SQS**: Low-cost message processing
- **CloudWatch**: Log retention policies to manage storage

### Efficiency Measures
- Smart sync reduces data transfer costs
- Appropriate Lambda sizing
- SQS batch processing
- Lifecycle policies for S3 objects

## Disaster Recovery

### Data Backup
- S3 versioning enabled for data recovery
- Cross-region replication available if needed
- Lambda function code stored in version control

### Failure Recovery
- Dead letter queues for message recovery
- CloudWatch alarms for automated notifications
- Infrastructure as Code for rapid redeployment

### Monitoring and Alerting
- Real-time failure detection
- Automated retry mechanisms
- Manual intervention workflows

## Compliance and Governance

### Data Governance
- Clear data lineage tracking
- Metadata preservation
- Audit trails in CloudWatch

### Compliance Features
- No PII or sensitive data processing
- Public data sources only
- Transparent data processing workflows

## Future Enhancements

### Potential Improvements
1. **Data Quality Monitoring**: Automated data validation and quality checks
2. **Advanced Analytics**: Machine learning model integration
3. **Real-time Processing**: Streaming analytics with Kinesis
4. **Data Catalog**: AWS Glue integration for data discovery
5. **API Gateway**: REST API for external data access
6. **Multi-region Deployment**: Geographic redundancy
7. **Enhanced Monitoring**: Custom CloudWatch dashboards
8. **Cost Analytics**: Detailed cost tracking and optimization

### Architectural Evolution
- Microservices decomposition for larger scale
- Container-based deployment with ECS/EKS
- Event sourcing patterns for audit trails
- CQRS for read/write separation