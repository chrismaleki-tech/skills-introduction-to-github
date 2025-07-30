# BLS Data Synchronization Script - Enhanced Version

This enhanced BLS (Bureau of Labor Statistics) data synchronization script automatically discovers and downloads all data files from the BLS website recursively, then uploads them to AWS S3. It uses environment variables from your connected GitHub repository for configuration.

## 🚀 Enhanced Features

### Core Enhancements
- **Recursive File Discovery**: Automatically explores all subdirectories on the BLS website
- **GitHub Environment Integration**: Uses environment variables from connected GitHub repo secrets
- **Concurrent Processing**: Multi-threaded file discovery and processing
- **Smart Sync**: Only uploads new or changed files (ETag-based detection)
- **Comprehensive Logging**: Detailed progress tracking and error reporting
- **Robust Error Handling**: Graceful handling of network issues and rate limiting

### Technical Improvements
- **Enhanced User-Agent**: Modern browser headers to avoid 403 Forbidden errors
- **Rate Limiting**: Respectful delays between requests
- **Depth Control**: Configurable maximum recursion depth
- **File Type Filtering**: Supports multiple data file formats (.txt, .csv, .data, .xlsx, .json, etc.)
- **Path Normalization**: Proper handling of file paths across different systems
- **Duplicate Detection**: Prevents processing the same files multiple times

## 📋 Environment Variables

### Required (from GitHub Repo Secrets)
```bash
AWS_ACCESS_KEY_ID       # Your AWS access key ID
AWS_SECRET_ACCESS_KEY   # Your AWS secret access key
```

### Optional (with defaults)
```bash
AWS_DEFAULT_REGION=us-east-2                           # AWS region
BLS_BUCKET_NAME=rearc-quest-bls-data                  # S3 bucket name
BLS_BASE_URL=https://download.bls.gov/pub/time.series/ # BLS base URL
BLS_MAX_WORKERS=3                                      # Concurrent workers
BLS_MAX_DEPTH=5                                        # Max recursion depth
DEBUG=false                                            # Enable debug logging
```

## 🔧 Setup Instructions

### 1. GitHub Actions Setup
1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add the following repository secrets:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key
   - Optionally add other configuration variables

### 2. Local Development Setup
```bash
# Clone repository
git clone <your-repo-url>
cd <repo-directory>/part1_data_sourcing

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export AWS_ACCESS_KEY_ID='your_access_key_here'
export AWS_SECRET_ACCESS_KEY='your_secret_key_here'
export BLS_BUCKET_NAME='your-test-bucket'

# Run the sync
python bls_data_sync.py
# or use the demo runner
python run_bls_sync.py
```

### 3. Docker Setup
```dockerfile
# Example Dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Set environment variables
ENV AWS_ACCESS_KEY_ID=your_key
ENV AWS_SECRET_ACCESS_KEY=your_secret
ENV BLS_BUCKET_NAME=your_bucket

CMD ["python", "bls_data_sync.py"]
```

## 🎯 Usage Examples

### Basic Usage
```bash
python bls_data_sync.py
```

### With Environment Check
```bash
python run_bls_sync.py
```

### Debug Mode
```bash
export DEBUG=true
python bls_data_sync.py
```

### Custom Configuration
```bash
export BLS_BASE_URL='https://download.bls.gov/pub/time.series/ap/'
export BLS_MAX_DEPTH='3'
export BLS_MAX_WORKERS='5'
python bls_data_sync.py
```

## 📁 File Structure

```
part1_data_sourcing/
├── bls_data_sync.py       # Main enhanced sync script
├── run_bls_sync.py        # Demo runner with environment checks
├── requirements.txt       # Python dependencies
└── README.md             # This documentation
```

## 🔍 How Recursive Discovery Works

1. **Start**: Begins at the configured base URL
2. **Parse**: Extracts all links from each page using BeautifulSoup
3. **Filter**: Identifies data files vs. directories using smart filtering
4. **Recurse**: Explores subdirectories up to the configured max depth
5. **Deduplicate**: Removes duplicate files found in multiple locations
6. **Process**: Downloads and uploads files concurrently

### File Type Detection
The script automatically detects and processes these file types:
- `.txt` - Text data files
- `.csv` - Comma-separated values
- `.data` - BLS data format
- `.xlsx/.xls` - Excel spreadsheets
- `.json` - JSON data
- `.xml` - XML data
- `.tsv` - Tab-separated values

### Directory Detection
Intelligently identifies directories by:
- URLs ending with `/`
- Links without file extensions
- Common BLS directory names (`data`, `series`, `time`)
- Excluding parent directory links (`../`, `./`)

## 📊 Output and Monitoring

### Console Output
```
🎯 FINAL SYNC SUMMARY:
📊 Total files discovered: 156
📤 Files uploaded: 23
🪣 S3 bucket: rearc-quest-bls-data
🔗 S3 path: s3://rearc-quest-bls-data/bls-data/
🌐 Source: https://download.bls.gov/pub/time.series/
```

### Detailed Logs
```
2024-01-15 10:30:15 - BLSDataSyncer - INFO - Starting recursive file discovery
2024-01-15 10:30:16 - BLSDataSyncer - INFO - Exploring https://download.bls.gov/pub/time.series/ (depth: 0)
2024-01-15 10:30:17 - BLSDataSyncer - INFO - Found 15 files and 8 subdirectories
2024-01-15 10:30:18 - BLSDataSyncer - INFO - Discovered 156 unique files across all directories
```

### S3 Organization
Files are uploaded to S3 with the following structure:
```
s3://your-bucket/bls-data/
├── pr.data
├── pr.series
├── pr.txt
├── subdirectory_file.csv
└── ...
```

## ⚡ Performance Features

- **Concurrent Downloads**: Multiple files processed simultaneously
- **Smart Caching**: ETag-based change detection prevents unnecessary uploads
- **Rate Limiting**: Respectful delays to avoid overwhelming BLS servers
- **Memory Efficient**: Streams large files without loading entirely into memory
- **Resume Capability**: Can resume interrupted syncs

## 🛠️ Troubleshooting

### Common Issues

1. **403 Forbidden Errors**
   - The script uses modern browser headers to avoid this
   - If still occurring, increase `request_delay` in the script

2. **AWS Credentials Not Found**
   ```bash
   # Verify environment variables are set
   echo $AWS_ACCESS_KEY_ID
   echo $AWS_SECRET_ACCESS_KEY
   ```

3. **Too Many Files Discovered**
   - Reduce `BLS_MAX_DEPTH` to limit recursion
   - Set `BLS_BASE_URL` to a more specific subdirectory

4. **Slow Performance**
   - Increase `BLS_MAX_WORKERS` for more concurrent processing
   - Decrease if hitting rate limits

### Debug Mode
Enable detailed logging:
```bash
export DEBUG=true
python bls_data_sync.py
```

## 🔐 Security Best Practices

1. **Never commit credentials** to code repository
2. **Use environment variables** for all sensitive configuration
3. **Set appropriate IAM permissions** for S3 bucket access
4. **Regularly rotate** AWS access keys
5. **Monitor S3 costs** as BLS has many files

## 📈 Scaling Considerations

- **Large Datasets**: BLS has thousands of files across many categories
- **Storage Costs**: Monitor S3 storage and transfer costs
- **Processing Time**: Full sync may take hours depending on depth
- **Bandwidth**: Respectful rate limiting may slow large syncs
- **Memory Usage**: Script is optimized for low memory footprint

## 🤝 Contributing

To enhance this script:
1. Fork the repository
2. Create a feature branch
3. Test with various BLS subdirectories
4. Submit a pull request with detailed description

## 📄 License

See the main repository LICENSE file for details.