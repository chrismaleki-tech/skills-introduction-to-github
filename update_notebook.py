#!/usr/bin/env python3

import json

# Read the notebook
with open('part3_analytics/executed_analysis.ipynb', 'r') as f:
    nb = json.load(f)

# New code for cell 6 with gzip loading functionality
new_code = [
    "import gzip\n",
    "\n",
    "def load_gzip_txt_as_df(bucket_name, key, delimiter=\"\\t\", header=None):\n",
    "    \"\"\"Load a gzip-compressed plain text file into DataFrame\"\"\"\n",
    "    data = load_data_from_s3(bucket_name, key)\n",
    "    if data:\n",
    "        with gzip.GzipFile(fileobj=io.BytesIO(data)) as gz:\n",
    "            return pd.read_csv(gz, delimiter=delimiter, header=header, names=[\"series_id\", \"year\", \"period\", \"value\", \"footnote_codes\"])\n",
    "    return None\n",
    "\n",
    "BLS_BUCKET_NAME = 'rearc-bls-pr-data'  # ✅ Correct\n",
    "bls_df = load_gzip_txt_as_df(BLS_BUCKET_NAME, 'bls-data/pr.data.0.Current')\n",
    "\n",
    "if bls_df is not None:\n",
    "    print(\"✅ BLS time-series data loaded successfully\")\n",
    "    print(f\"Data shape: {bls_df.shape}\")\n",
    "    print(f\"Columns: {list(bls_df.columns)}\")\n",
    "    \n",
    "    # Display first few rows\n",
    "    print(\"\\nFirst 5 rows:\")\n",
    "    display(bls_df.head())\n",
    "    \n",
    "    # Data cleaning and preprocessing\n",
    "    # Remove any whitespace from string columns\n",
    "    for col in bls_df.select_dtypes(include=['object']).columns:\n",
    "        bls_df[col] = bls_df[col].astype(str).str.strip()\n",
    "    \n",
    "    # Convert year to int if it's not already\n",
    "    if 'year' in bls_df.columns:\n",
    "        bls_df['year'] = pd.to_numeric(bls_df['year'], errors='coerce')\n",
    "    \n",
    "    # Convert value to numeric\n",
    "    if 'value' in bls_df.columns:\n",
    "        bls_df['value'] = pd.to_numeric(bls_df['value'], errors='coerce')\n",
    "    \n",
    "    print(f\"\\nData types after cleaning:\")\n",
    "    print(bls_df.dtypes)\n",
    "    \n",
    "    print(f\"\\nUnique series_id count: {bls_df['series_id'].nunique()}\")\n",
    "    print(f\"Year range: {bls_df['year'].min()} to {bls_df['year'].max()}\")\n",
    "    print(f\"Unique periods: {sorted(bls_df['period'].unique())}\")\n",
    "    \n",
    "    # Check for missing values\n",
    "    print(f\"\\nMissing values:\")\n",
    "    print(bls_df.isnull().sum())\n",
    "    \n",
    "else:\n",
    "    print(\"❌ Failed to load BLS data\")\n",
    "    bls_df = pd.DataFrame()"
]

# Update cell 6 with the new code
nb['cells'][6]['source'] = new_code

# Write the updated notebook
with open('part3_analytics/executed_analysis.ipynb', 'w') as f:
    json.dump(nb, f, indent=1)

print('✅ Successfully updated cell 6 with gzip loading functionality')
print('✅ Updated BLS_BUCKET_NAME to rearc-bls-pr-data')
print('✅ Added import gzip and load_gzip_txt_as_df function')
