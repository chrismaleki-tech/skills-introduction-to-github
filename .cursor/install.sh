#!/usr/bin/env bash
#
# Idempotent development-environment bootstrap for the Rearc Data Quest repo.
#
# Installs, in a way that is safe to re-run:
#   * a Python virtualenv (.venv) with every part's dependencies
#   * the AWS CLI v2 (from the bundle vendored in ./aws)
#   * the AWS CDK CLI (npm, into a user-writable prefix)
#   * uv/uvx (used by .cursor/mcp.json and the datagolf tooling)
# and wires the resulting toolchain onto PATH for interactive shells.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 0. System packages (Python venv support + build headers)
# ---------------------------------------------------------------------------
log "Ensuring system packages (python3-venv, build tooling)"
if command -v apt-get >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  PY_MM="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends \
    "python${PY_MM}-venv" python3-pip build-essential curl unzip
else
  echo "apt-get/sudo unavailable; assuming python3-venv is already present"
fi

# ---------------------------------------------------------------------------
# 1. Python virtualenv + dependencies
# ---------------------------------------------------------------------------
log "Creating Python virtualenv (.venv)"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install --upgrade pip setuptools wheel

log "Installing Python dependencies for all parts"
# pip de-duplicates overlapping pins across these files.
pip install \
  -r requirements.txt \
  -r part1_data_sourcing/requirements.txt \
  -r part2_api_integration/requirements.txt \
  -r part3_analytics/requirements.txt \
  -r part4_infrastructure/cdk/requirements.txt \
  -r part4_infrastructure/lambda_functions/requirements.txt

# uv / uvx power the sportsdata MCP server (.cursor/mcp.json) and are handy for
# the datagolf tooling. Installed into the venv so `uvx` is on PATH.
log "Installing uv / uvx"
pip install uv

# ---------------------------------------------------------------------------
# 2. AWS CLI v2 (official installer)
# ---------------------------------------------------------------------------
# NOTE: the bundle vendored in ./aws ships a prebuilt interpreter that fails to
# start on this base image ("No module named 'encodings'"), so we install the
# current AWS CLI v2 from the official distribution instead.
log "Installing AWS CLI v2"
if command -v aws >/dev/null 2>&1; then
  echo "aws already on PATH: $(aws --version 2>&1)"
else
  case "$(uname -m)" in
    aarch64|arm64) AWS_CLI_ARCH="aarch64" ;;
    *)             AWS_CLI_ARCH="x86_64" ;;
  esac
  AWS_TMP="$(mktemp -d)"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_CLI_ARCH}.zip" \
    -o "$AWS_TMP/awscliv2.zip"
  unzip -q "$AWS_TMP/awscliv2.zip" -d "$AWS_TMP"
  if sudo -n true 2>/dev/null; then
    sudo "$AWS_TMP/aws/install" --update
  else
    "$AWS_TMP/aws/install" --update -i "$HOME/.local/aws-cli" -b "$HOME/.local/bin"
  fi
  rm -rf "$AWS_TMP"
fi

# ---------------------------------------------------------------------------
# 3. AWS CDK CLI (npm, user-writable prefix to avoid needing root)
# ---------------------------------------------------------------------------
log "Installing AWS CDK CLI"
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
mkdir -p "$NPM_CONFIG_PREFIX"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
if command -v cdk >/dev/null 2>&1; then
  echo "cdk already on PATH: $(cdk --version 2>&1)"
else
  npm install -g aws-cdk
fi

# ---------------------------------------------------------------------------
# 4. Make the toolchain available to interactive shells
# ---------------------------------------------------------------------------
log "Wiring toolchain onto PATH for future shells"
BASHRC="$HOME/.bashrc"
MARKER="# >>> rearc-data-quest dev env >>>"
if ! grep -qF "$MARKER" "$BASHRC" 2>/dev/null; then
  cat >>"$BASHRC" <<EOF

$MARKER
export NPM_CONFIG_PREFIX="\$HOME/.npm-global"
export PATH="\$HOME/.local/bin:\$HOME/.npm-global/bin:\$PATH"
if [ -f "$REPO_ROOT/.venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi
# <<< rearc-data-quest dev env <<<
EOF
fi

log "Environment setup complete"
echo "python : $(python --version 2>&1)  ($(command -v python))"
echo "pip    : $(pip --version 2>&1 | cut -d' ' -f1-2)"
echo "aws    : $(aws --version 2>&1 || echo 'not found')"
echo "cdk    : $(cdk --version 2>&1 || echo 'not found')"
echo "node   : $(node --version 2>&1)"
