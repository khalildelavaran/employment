#!/usr/bin/env bash
# ==============================================================================
# Employment Platform — Production Installer for Ubuntu (Non-Docker)
# Repository: https://github.com/khalildelavaran/employment
# ==============================================================================
# Installs all OS prerequisites, Node.js 22 LTS, isolated system user and
# directories, GitHub SSH Deploy Key, SQLite WAL database, systemd service,
# Nginx Reverse Proxy (with optional Let's Encrypt Certbot HTTPS), and UFW.
# Safe to re-run (idempotent); never overwrites existing .env or database.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ------------------------------------------------------------------------------
# Default Configuration (overridable via CLI flags or environment variables)
# ------------------------------------------------------------------------------
APP_NAME="${APP_NAME:-employment}"
SERVICE_NAME="${SERVICE_NAME:-employment}"
SERVICE_USER="${SERVICE_USER:-employment}"
SERVICE_GROUP="${SERVICE_GROUP:-employment}"

INSTALL_DIR="${INSTALL_DIR:-/opt/employment}"
CONFIG_DIR="${CONFIG_DIR:-/etc/employment}"
DATA_DIR="${DATA_DIR:-/var/lib/employment/data}"
STATE_DIR="${STATE_DIR:-/var/lib/employment}"
LOG_DIR="${LOG_DIR:-/var/log/employment}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/employment}"

REPO_SSH="${REPO_SSH:-git@github.com:khalildelavaran/employment.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
GITHUB_SSH_MODE="${GITHUB_SSH_MODE:-auto}" # auto (443 first, then 22), 443, or 22
GITHUB_SSH_HOST="ssh.github.com"
GITHUB_SSH_PORT="443"
GIT_TIMEOUT_SEC="${GIT_TIMEOUT_SEC:-180}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-3000}"

DOMAIN="${DOMAIN:-_}"
SSL_EMAIL="${SSL_EMAIL:-}"
ENABLE_SSL="${ENABLE_SSL:-false}"
SKIP_UFW="${SKIP_UFW:-false}"
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"
NODE_MAJOR_REQUIRED="22"

CURRENT_STAGE="Initialization"
LOG_FILE=""

# ------------------------------------------------------------------------------
# Usage / Help
# ------------------------------------------------------------------------------
usage() {
  cat <<'EOF'
Usage: sudo ./install-employment.sh [OPTIONS]

Options:
  --install-dir PATH       Base install directory (default: /opt/employment)
  --config-dir PATH        Config & secrets directory (default: /etc/employment)
  --data-dir PATH          SQLite database directory (default: /var/lib/employment/data)
  --log-dir PATH           Log files directory (default: /var/log/employment)
  --backup-dir PATH        Backups directory (default: /var/backups/employment)
  --repo-ssh URL           GitHub SSH URL (default: git@github.com:khalildelavaran/employment.git)
  --branch NAME            Git branch to deploy (default: main)
  --github-ssh-port MODE   GitHub SSH transport: auto (443 then 22), 443, or 22 (default: auto)
  --port PORT              Internal Node.js port (default: 3000)
  --domain DOMAIN          Public domain for Nginx (default: _ for IP/catch-all)
  --enable-ssl             Provision HTTPS certificate via Let's Encrypt Certbot
  --email EMAIL            Admin email for Let's Encrypt (required with --enable-ssl)
  --service-user USER      Linux system user for the app (default: employment)
  --skip-ufw               Do not modify UFW firewall rules
  --non-interactive        Fail instead of prompting if GitHub Deploy Key is not authorized yet
  -h, --help               Show this help message

Examples:
  # Install behind Nginx HTTP (accessible via server IP):
  sudo ./install-employment.sh

  # Install with custom domain and automatic Let's Encrypt HTTPS:
  sudo ./install-employment.sh --domain profile.dastva.co --enable-ssl --email ops@dastva.co
EOF
}

# ------------------------------------------------------------------------------
# Parse CLI Arguments
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)     INSTALL_DIR="$2"; shift 2 ;;
    --config-dir)      CONFIG_DIR="$2"; shift 2 ;;
    --data-dir)        DATA_DIR="$2"; shift 2 ;;
    --log-dir)         LOG_DIR="$2"; shift 2 ;;
    --backup-dir)      BACKUP_DIR="$2"; shift 2 ;;
    --repo-ssh)        REPO_SSH="$2"; shift 2 ;;
    --branch)          REPO_BRANCH="$2"; shift 2 ;;
    --github-ssh-port) GITHUB_SSH_MODE="$2"; shift 2 ;;
    --port)            APP_PORT="$2"; shift 2 ;;
    --domain)          DOMAIN="$2"; shift 2 ;;
    --email)           SSL_EMAIL="$2"; shift 2 ;;
    --enable-ssl)      ENABLE_SSL="true"; shift ;;
    --service-user)    SERVICE_USER="$2"; SERVICE_GROUP="$2"; shift 2 ;;
    --skip-ufw)        SKIP_UFW="true"; shift ;;
    --non-interactive) NON_INTERACTIVE="true"; shift ;;
    -h|--help)         usage; exit 0 ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

APP_DIR="${INSTALL_DIR}/app"
SCRIPTS_DIR="${INSTALL_DIR}/scripts"
ENV_FILE="${CONFIG_DIR}/employment.env"
SSH_DIR="${CONFIG_DIR}/ssh"
SSH_KEY_PATH="${SSH_DIR}/deploy_key"
SSH_CONFIG_PATH="${SSH_DIR}/config"
SSH_KNOWN_HOSTS="${SSH_DIR}/known_hosts"
DB_FILE="${DATA_DIR}/dasteva_d1.sqlite"
STATE_FILE="${STATE_DIR}/install-state.env"

# ------------------------------------------------------------------------------
# Logging & Error Handling
# ------------------------------------------------------------------------------
timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

init_logging() {
  mkdir -p "${LOG_DIR}"
  chmod 750 "${LOG_DIR}"
  LOG_FILE="${LOG_DIR}/install-$(date '+%Y%m%d-%H%M%S').log"
  touch "${LOG_FILE}"
  chmod 640 "${LOG_FILE}"
  exec > >(tee -a "${LOG_FILE}") 2>&1
}

log_info() {
  echo "[$(timestamp)] [INFO]  $*"
}

log_warn() {
  echo "[$(timestamp)] [WARN]  $*"
}

log_error() {
  echo "[$(timestamp)] [ERROR] $*" >&2
}

stage_start() {
  CURRENT_STAGE="$1"
  echo ""
  echo "=============================================================================="
  echo "[$(timestamp)] STAGE: ${CURRENT_STAGE}"
  echo "=============================================================================="
}

on_error() {
  local exit_code="$?"
  local line_no="${1:-unknown}"
  echo "" >&2
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
  echo "[$(timestamp)] INSTALLATION FAILED" >&2
  echo "  Failed Stage : ${CURRENT_STAGE}" >&2
  echo "  Line Number  : ${line_no}" >&2
  echo "  Exit Code    : ${exit_code}" >&2
  echo "  Full Log     : ${LOG_FILE:-not-initialized}" >&2
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
  exit "${exit_code}"
}

trap 'on_error ${LINENO}' ERR

# Helper to run commands as the unprivileged service user
run_as_app_user() {
  sudo -u "${SERVICE_USER}" -H -- "$@"
}

# ------------------------------------------------------------------------------
# Stage 1: Preflight Environment Checks
# ------------------------------------------------------------------------------
stage_preflight() {
  stage_start "1/10 — Preflight System, OS, Architecture & Network Checks"

  if [[ "${EUID}" -ne 0 ]]; then
    log_error "This script must be executed as root (use: sudo $0)."
    exit 1
  fi

  if [[ ! -r /etc/os-release ]]; then
    log_error "Cannot read /etc/os-release. Unsupported Linux distribution."
    exit 1
  fi

  # shellcheck disable=SC1091
  source /etc/os-release
  log_info "Detected OS: ${PRETTY_NAME:-Unknown} (ID=${ID:-unknown}, VERSION_ID=${VERSION_ID:-unknown})"

  if [[ "${ID:-}" != "ubuntu" ]]; then
    log_error "Unsupported OS '${ID:-unknown}'. This installer targets Ubuntu LTS (22.04 / 24.04)."
    exit 1
  fi

  case "${VERSION_ID:-}" in
    22.04|24.04)
      log_info "Ubuntu ${VERSION_ID} LTS verified."
      ;;
    *)
      log_warn "Ubuntu ${VERSION_ID} is not 22.04/24.04 LTS. Continuing, but 22.04 or 24.04 LTS is recommended."
      ;;
  esac

  local arch
  arch="$(uname -m)"
  log_info "Detected CPU architecture: ${arch}"
  case "${arch}" in
    x86_64|aarch64) ;;
    *)
      log_error "Unsupported CPU architecture '${arch}'. Expected x86_64 (amd64) or aarch64 (arm64)."
      exit 1
      ;;
  esac

  # Validate port number
  if ! [[ "${APP_PORT}" =~ ^[0-9]+$ ]] || (( APP_PORT < 1024 || APP_PORT > 65535 )); then
    log_error "Invalid --port '${APP_PORT}'. Must be an integer between 1024 and 65535."
    exit 1
  fi

  # Validate SSL inputs if requested
  if [[ "${ENABLE_SSL}" == "true" ]]; then
    if [[ -z "${DOMAIN}" || "${DOMAIN}" == "_" ]]; then
      log_error "--enable-ssl requires a valid public --domain (e.g. --domain profile.dastva.co)."
      exit 1
    fi
    if [[ -z "${SSL_EMAIL}" ]]; then
      log_error "--enable-ssl requires --email for Let's Encrypt certificate notifications."
      exit 1
    fi
  fi

  # Disk space check (require at least 2 GB free on / or parent of INSTALL_DIR)
  local check_target="/"
  if [[ -d "${INSTALL_DIR}" ]]; then
    check_target="${INSTALL_DIR}"
  fi
  local free_kb
  free_kb="$(df -Pk "${check_target}" | awk 'NR==2 {print $4}')"
  local free_mb=$(( free_kb / 1024 ))
  log_info "Available disk space on '${check_target}': ${free_mb} MB"
  if (( free_mb < 2048 )); then
    log_error "Insufficient disk space (${free_mb} MB). At least 2048 MB free is required."
    exit 1
  fi

  # Internet & GitHub reachability check
  log_info "Checking internet and GitHub connectivity..."
  if ! getent hosts github.com >/dev/null 2>&1; then
    log_error "DNS resolution failed for github.com. Check network/DNS configuration."
    exit 1
  fi
  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsSI --max-time 15 https://github.com >/dev/null 2>&1; then
      log_error "Cannot reach https://github.com over HTTPS. Check firewall or outbound internet."
      exit 1
    fi
  fi

  log_info "Preflight checks passed."
}

# ------------------------------------------------------------------------------
# Stage 2: Install System Prerequisites
# ------------------------------------------------------------------------------
stage_system_packages() {
  stage_start "2/10 — Installing Ubuntu System Prerequisites"

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y

  local packages=(
    ca-certificates
    curl
    gnupg
    lsb-release
    git
    openssh-client
    build-essential
    python3
    make
    g++
    sqlite3
    nginx
    ufw
    rsync
    sudo
  )

  if [[ "${ENABLE_SSL}" == "true" ]]; then
    packages+=(certbot python3-certbot-nginx)
  fi

  log_info "Installing APT packages: ${packages[*]}"
  apt-get install -y --no-install-recommends "${packages[@]}"
  log_info "System packages installed successfully."
}

# ------------------------------------------------------------------------------
# Stage 3: Install & Verify Node.js 22 LTS
# ------------------------------------------------------------------------------
stage_nodejs() {
  stage_start "3/10 — Installing & Verifying Node.js ${NODE_MAJOR_REQUIRED}.x LTS"

  local need_node_install="true"
  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -p 'process.versions.node.split(".")[0]')"
    log_info "Existing Node.js detected: $(node -v) (major=${current_major})"
    if [[ "${current_major}" == "${NODE_MAJOR_REQUIRED}" ]]; then
      need_node_install="false"
      log_info "Node.js ${NODE_MAJOR_REQUIRED}.x LTS is already installed. Skipping reinstall."
    else
      log_warn "Node.js major version ${current_major} differs from required ${NODE_MAJOR_REQUIRED}. Installing Node.js ${NODE_MAJOR_REQUIRED}.x LTS..."
    fi
  fi

  if [[ "${need_node_install}" == "true" ]]; then
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR_REQUIRED}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y nodejs
  fi

  local node_ver npm_ver node_major
  node_ver="$(node -v)"
  npm_ver="$(npm -v)"
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "${node_major}" != "${NODE_MAJOR_REQUIRED}" ]]; then
    log_error "Node.js version verification failed: expected ${NODE_MAJOR_REQUIRED}.x, got ${node_ver}."
    exit 1
  fi

  log_info "Verified Runtime -> Node.js: ${node_ver}, npm: v${npm_ver}, sqlite3: $(sqlite3 --version | awk '{print $1}')"
}

# ------------------------------------------------------------------------------
# Stage 4: Create System User & Isolated Production Directory Structure
# ------------------------------------------------------------------------------
stage_directories_and_user() {
  stage_start "4/10 — Creating Service User & Isolated Directory Structure"

  if ! getent group "${SERVICE_GROUP}" >/dev/null 2>&1; then
    groupadd --system "${SERVICE_GROUP}"
    log_info "Created system group '${SERVICE_GROUP}'."
  else
    log_info "System group '${SERVICE_GROUP}' already exists."
  fi

  if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
    useradd \
      --system \
      --gid "${SERVICE_GROUP}" \
      --home-dir "${INSTALL_DIR}" \
      --shell /usr/sbin/nologin \
      --comment "Employment Platform Service Account" \
      "${SERVICE_USER}"
    log_info "Created system user '${SERVICE_USER}'."
  else
    log_info "System user '${SERVICE_USER}' already exists."
  fi

  install -d -m 0755 -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${INSTALL_DIR}"
  install -d -m 0755 -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${APP_DIR}"
  install -d -m 0750 -o root -g "${SERVICE_GROUP}" "${SCRIPTS_DIR}"
  install -d -m 0750 -o root -g "${SERVICE_GROUP}" "${CONFIG_DIR}"
  install -d -m 0700 -o root -g root "${SSH_DIR}"
  install -d -m 0750 -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${STATE_DIR}"
  install -d -m 0750 -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${DATA_DIR}"
  install -d -m 0750 -o root -g "${SERVICE_GROUP}" "${LOG_DIR}"
  install -d -m 0750 -o root -g "${SERVICE_GROUP}" "${BACKUP_DIR}"

  log_info "Directory structure prepared:"
  log_info "  App Source : ${APP_DIR}"
  log_info "  Scripts    : ${SCRIPTS_DIR}"
  log_info "  Config     : ${CONFIG_DIR}"
  log_info "  SQLite DB  : ${DATA_DIR}"
  log_info "  Logs       : ${LOG_DIR}"
  log_info "  Backups    : ${BACKUP_DIR}"
}

# ------------------------------------------------------------------------------
# Stage 5: Configure Private GitHub SSH Deploy Key (Defaulting to Port 443)
# ------------------------------------------------------------------------------
write_github_ssh_config() {
  local host="$1"
  local port="$2"
  GITHUB_SSH_HOST="${host}"
  GITHUB_SSH_PORT="${port}"

  cat > "${SSH_CONFIG_PATH}" <<EOF
Host github.com
  HostName ${host}
  Port ${port}
  User git
  IdentityFile ${SSH_KEY_PATH}
  IdentitiesOnly yes
  UserKnownHostsFile ${SSH_KNOWN_HOSTS}
  StrictHostKeyChecking accept-new
  ConnectTimeout 15
  ServerAliveInterval 15
  ServerAliveCountMax 3
EOF
  chmod 600 "${SSH_CONFIG_PATH}"
  chown root:root "${SSH_CONFIG_PATH}"
  log_info "Configured GitHub SSH endpoint -> ${host}:${port}"
}

seed_github_known_hosts() {
  touch "${SSH_KNOWN_HOSTS}"
  # Official GitHub ED25519 host key fingerprint: SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU
  local gh_ed25519="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"

  if ! grep -q '^\[ssh\.github\.com\]:443 ' "${SSH_KNOWN_HOSTS}" 2>/dev/null; then
    ssh-keyscan -T 10 -p 443 -t ed25519,rsa ssh.github.com >> "${SSH_KNOWN_HOSTS}" 2>/dev/null || true
    if ! grep -q '^\[ssh\.github\.com\]:443 ' "${SSH_KNOWN_HOSTS}" 2>/dev/null; then
      echo "[ssh.github.com]:443 ${gh_ed25519}" >> "${SSH_KNOWN_HOSTS}"
    fi
  fi

  if ! grep -q '^github\.com ' "${SSH_KNOWN_HOSTS}" 2>/dev/null; then
    ssh-keyscan -T 10 -p 22 -t ed25519,rsa github.com >> "${SSH_KNOWN_HOSTS}" 2>/dev/null || true
    if ! grep -q '^github\.com ' "${SSH_KNOWN_HOSTS}" 2>/dev/null; then
      echo "github.com ${gh_ed25519}" >> "${SSH_KNOWN_HOSTS}"
    fi
  fi

  chmod 644 "${SSH_KNOWN_HOSTS}"
  chown root:root "${SSH_KNOWN_HOSTS}"
  log_info "Pinned GitHub SSH host keys (ssh.github.com:443 & github.com:22) in ${SSH_KNOWN_HOSTS}."
}

select_github_ssh_endpoint() {
  case "${GITHUB_SSH_MODE}" in
    443)
      write_github_ssh_config "ssh.github.com" "443"
      ;;
    22)
      write_github_ssh_config "github.com" "22"
      ;;
    auto|*)
      # Prefer ssh.github.com:443 because ISPs/datacenters often throttle or freeze git-upload-pack on TCP/22
      if timeout 8 bash -c 'cat < /dev/null > /dev/tcp/ssh.github.com/443' 2>/dev/null; then
        write_github_ssh_config "ssh.github.com" "443"
      elif timeout 8 bash -c 'cat < /dev/null > /dev/tcp/github.com/22' 2>/dev/null; then
        log_warn "ssh.github.com:443 unreachable; falling back to github.com:22."
        write_github_ssh_config "github.com" "22"
      else
        log_warn "Could not pre-verify TCP 443/22 via /dev/tcp; defaulting to ssh.github.com:443."
        write_github_ssh_config "ssh.github.com" "443"
      fi
      ;;
  esac
}

test_github_ssh() {
  local output=""
  set +e
  output="$(timeout 20 ssh -F "${SSH_CONFIG_PATH}" -o BatchMode=yes -o ConnectTimeout=12 -T git@github.com 2>&1)"
  local rc=$?
  set -e
  # GitHub returns exit code 1 with "successfully authenticated" when SSH key is valid
  if echo "${output}" | grep -qi "successfully authenticated"; then
    return 0
  fi
  log_warn "GitHub SSH auth check (${GITHUB_SSH_HOST}:${GITHUB_SSH_PORT}) returned code ${rc}: ${output}"
  return 1
}

stage_github_ssh() {
  stage_start "5/10 — Setting Up Read-Only GitHub SSH Deploy Key"

  if [[ ! -f "${SSH_KEY_PATH}" ]]; then
    ssh-keygen -t ed25519 -N "" -C "employment-deploy@$(hostname -f 2>/dev/null || hostname)" -f "${SSH_KEY_PATH}"
    chmod 600 "${SSH_KEY_PATH}"
    chmod 644 "${SSH_KEY_PATH}.pub"
    chown root:root "${SSH_KEY_PATH}" "${SSH_KEY_PATH}.pub"
    log_info "Generated new ed25519 SSH Deploy Key at ${SSH_KEY_PATH}."
  else
    chmod 600 "${SSH_KEY_PATH}"
    chown root:root "${SSH_KEY_PATH}"
    log_info "Reusing existing SSH Deploy Key at ${SSH_KEY_PATH}."
  fi

  seed_github_known_hosts
  select_github_ssh_endpoint

  if ! test_github_ssh; then
    echo ""
    echo "=============================================================================="
    echo "ACTION REQUIRED: Register this Read-Only SSH Deploy Key on GitHub"
    echo "=============================================================================="
    echo "1. Open: https://github.com/khalildelavaran/employment/settings/keys"
    echo "2. Click 'Add deploy key'"
    echo "3. Title: $(hostname) - employment production (leave 'Allow write access' UNCHECKED)"
    echo "4. Paste the public key below:"
    echo ""
    cat "${SSH_KEY_PATH}.pub"
    echo ""
    echo "=============================================================================="

    if [[ "${NON_INTERACTIVE}" == "true" ]]; then
      log_error "Non-interactive mode enabled and SSH Deploy Key is not yet authorized on GitHub. Add the key above and re-run this script."
      exit 2
    fi

    local attempts=0
    while true; do
      attempts=$((attempts + 1))
      read -r -p "Press [Enter] after adding the Deploy Key to GitHub (or Ctrl+C to abort)... " _
      if test_github_ssh; then
        log_info "GitHub SSH authentication succeeded!"
        break
      fi
      if (( attempts >= 5 )); then
        log_error "GitHub SSH authentication failed after ${attempts} attempts."
        exit 2
      fi
      log_warn "Still not authorized. Please confirm the key was saved in GitHub Deploy Keys and try again."
    done
  else
    log_info "GitHub SSH Deploy Key is already authorized via ${GITHUB_SSH_HOST}:${GITHUB_SSH_PORT}."
  fi
}

# ------------------------------------------------------------------------------
# Stage 6: Clone or Sync Source Code from GitHub (with Timeout & Fallback)
# ------------------------------------------------------------------------------
run_git_network_op() {
  local git_ssh_cmd="ssh -F ${SSH_CONFIG_PATH} -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"
  if timeout "${GIT_TIMEOUT_SEC}" env GIT_SSH_COMMAND="${git_ssh_cmd}" "$@"; then
    return 0
  fi

  # Automatic fallback between 443 and 22 if in 'auto' mode
  if [[ "${GITHUB_SSH_MODE}" == "auto" ]]; then
    if [[ "${GITHUB_SSH_PORT}" == "443" ]]; then
      log_warn "Git operation timed out or failed over ssh.github.com:443; retrying over github.com:22..."
      write_github_ssh_config "github.com" "22"
    else
      log_warn "Git operation timed out or failed over github.com:22; retrying over ssh.github.com:443..."
      write_github_ssh_config "ssh.github.com" "443"
    fi
    git_ssh_cmd="ssh -F ${SSH_CONFIG_PATH} -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"
    timeout "${GIT_TIMEOUT_SEC}" env GIT_SSH_COMMAND="${git_ssh_cmd}" "$@"
    return $?
  fi

  return 1
}

stage_fetch_source() {
  stage_start "6/10 — Fetching Employment Source Code from GitHub (${REPO_BRANCH})"

  git config --system --add safe.directory "${APP_DIR}" 2>/dev/null || true

  # Verify git-upload-pack works before cloning/fetching
  log_info "Verifying git-upload-pack stream via ${GITHUB_SSH_HOST}:${GITHUB_SSH_PORT}..."
  run_git_network_op git ls-remote --heads "${REPO_SSH}" "${REPO_BRANCH}" >/dev/null

  if [[ -d "${APP_DIR}/.git" ]] && git -C "${APP_DIR}" rev-parse --git-dir >/dev/null 2>&1; then
    log_info "Existing Git repository found in ${APP_DIR}. Fetching latest '${REPO_BRANCH}'..."
    git -C "${APP_DIR}" remote set-url origin "${REPO_SSH}"
    run_git_network_op git -C "${APP_DIR}" fetch --progress --prune origin "${REPO_BRANCH}"
    git -C "${APP_DIR}" checkout -B "${REPO_BRANCH}" "origin/${REPO_BRANCH}"
  else
    # Clean up partial/interrupted clone directory if it only has an incomplete .git folder
    if [[ -d "${APP_DIR}/.git" ]]; then
      log_warn "Removing incomplete .git directory from a previously interrupted clone in ${APP_DIR}..."
      rm -rf "${APP_DIR}/.git"
    fi
    # Ensure APP_DIR is empty before fresh clone
    if [[ -n "$(ls -A "${APP_DIR}" 2>/dev/null || true)" ]]; then
      log_error "${APP_DIR} is not empty and is not a valid Git repository. Refusing to overwrite existing files."
      exit 1
    fi
    log_info "Cloning ${REPO_SSH} (branch: ${REPO_BRANCH}) into ${APP_DIR} via ${GITHUB_SSH_HOST}:${GITHUB_SSH_PORT}..."
    run_git_network_op git clone --progress --branch "${REPO_BRANCH}" --single-branch "${REPO_SSH}" "${APP_DIR}"
  fi

  local deployed_commit
  deployed_commit="$(git -C "${APP_DIR}" rev-parse --short HEAD)"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"
  log_info "Source code ready at commit ${deployed_commit}."
}

# ------------------------------------------------------------------------------
# Stage 7: Prepare Protected Environment Configuration (Never Overwrite Existing)
# ------------------------------------------------------------------------------
stage_environment_config() {
  stage_start "7/10 — Preparing Production Environment File (${ENV_FILE})"

  if [[ -f "${ENV_FILE}" ]]; then
    log_info "Existing ${ENV_FILE} detected. Preserving existing configuration and secrets."
    chown root:"${SERVICE_GROUP}" "${ENV_FILE}"
    chmod 640 "${ENV_FILE}"
    return
  fi

  local scheme="http"
  if [[ "${ENABLE_SSL}" == "true" ]]; then
    scheme="https"
  fi
  local public_host="${DOMAIN}"
  if [[ "${public_host}" == "_" ]]; then
    public_host="$(hostname -I | awk '{print $1}')"
  fi

  cat > "${ENV_FILE}" <<EOF
# ==============================================================================
# Employment Platform — Production Environment Configuration
# Generated on $(timestamp)
# Permissions: root:${SERVICE_GROUP} (0640) — NEVER commit this file to Git.
# ==============================================================================

NODE_ENV=production
HOST=${APP_HOST}
PORT=${APP_PORT}

# Persistent SQLite database (kept strictly outside /opt/employment/app)
DB_PATH=${DB_FILE}

# Public application URL
APP_URL=${scheme}://${public_host}

# FarazSMS / IranPayamak REST API (server-side only)
# Replace YOUR_FARAZSMS_API_KEY with your real panel key, then restart:
#   sudo systemctl restart ${SERVICE_NAME}
FARAZSMS_BASE_URL=https://api.iranpayamak.com
FARAZSMS_API_KEY=
FARAZSMS_KEY_TITLE=emloyment
FARAZSMS_LINE_NUMBER=
EOF

  chown root:"${SERVICE_GROUP}" "${ENV_FILE}"
  chmod 640 "${ENV_FILE}"
  log_info "Created initial environment file at ${ENV_FILE} (mode 0640)."
  log_warn "Remember to set FARAZSMS_API_KEY in ${ENV_FILE} if SMS notifications are used."
}

# ------------------------------------------------------------------------------
# Stage 8: Install Dependencies, Build Frontend & Initialize SQLite Database
# ------------------------------------------------------------------------------
stage_build_and_migrate() {
  stage_start "8/10 — Installing Dependencies, Building Frontend & Migrating SQLite DB"

  # Ensure npm cache resides inside service user's writable area
  local npm_cache_dir="${STATE_DIR}/.npm-cache"
  install -d -m 0750 -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${npm_cache_dir}"

  if [[ -f "${APP_DIR}/package-lock.json" ]]; then
    log_info "package-lock.json found; running 'npm ci'..."
    run_as_app_user env HOME="${STATE_DIR}" npm_config_cache="${npm_cache_dir}" \
      npm --prefix "${APP_DIR}" ci --no-audit --no-fund
  else
    log_info "Running 'npm install' (including native better-sqlite3 build)..."
    run_as_app_user env HOME="${STATE_DIR}" npm_config_cache="${npm_cache_dir}" \
      npm --prefix "${APP_DIR}" install --no-audit --no-fund
  fi

  log_info "Verifying native better-sqlite3 module load..."
  run_as_app_user bash -c "cd '${APP_DIR}' && node -e \"import('better-sqlite3').then(() => console.log('better-sqlite3 OK'))\""

  log_info "Building production React/Vite frontend bundle (dist/)..."
  run_as_app_user env HOME="${STATE_DIR}" NODE_ENV=production \
    npm --prefix "${APP_DIR}" run build

  if [[ ! -f "${APP_DIR}/dist/index.html" ]]; then
    log_error "Frontend build failed: ${APP_DIR}/dist/index.html not found."
    exit 1
  fi

  log_info "Initializing and migrating SQLite database at ${DB_FILE}..."
  if [[ -f "${APP_DIR}/scripts/migrate-db.ts" ]]; then
    run_as_app_user bash -c "set -a; source '${ENV_FILE}'; set +a; cd '${APP_DIR}' && ./node_modules/.bin/tsx scripts/migrate-db.ts"
  else
    # Fallback compatibility if older commit lacks scripts/migrate-db.ts
    run_as_app_user bash -c "set -a; source '${ENV_FILE}'; set +a; cd '${APP_DIR}' && ./node_modules/.bin/tsx -e \"import { getD1Database } from './src/db/d1Adapter.ts'; getD1Database(); console.log('DB initialized');\""
  fi

  # Verify database integrity
  local integrity
  integrity="$(sqlite3 "${DB_FILE}" "PRAGMA integrity_check;")"
  if [[ "${integrity}" != "ok" ]]; then
    log_error "SQLite integrity_check failed: ${integrity}"
    exit 1
  fi
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${DATA_DIR}"
  chmod 640 "${DB_FILE}"
  log_info "SQLite database initialized & verified (integrity_check=ok)."
}

# ------------------------------------------------------------------------------
# Stage 9: Configure systemd, Nginx Reverse Proxy, Optional Certbot & UFW
# ------------------------------------------------------------------------------
stage_services_and_proxy() {
  stage_start "9/10 — Configuring systemd Service, Nginx Reverse Proxy & Firewall"

  # 9a. Install operational scripts & symlink
  if [[ -f "${APP_DIR}/deploy/update-employment.sh" ]]; then
    install -m 0750 -o root -g "${SERVICE_GROUP}" "${APP_DIR}/deploy/update-employment.sh" "${SCRIPTS_DIR}/update-employment.sh"
    ln -sf "${SCRIPTS_DIR}/update-employment.sh" /usr/local/bin/employment-update
    log_info "Installed updater script to ${SCRIPTS_DIR}/update-employment.sh (/usr/local/bin/employment-update)."
  fi
  if [[ -f "${APP_DIR}/deploy/install-employment.sh" ]]; then
    install -m 0750 -o root -g "${SERVICE_GROUP}" "${APP_DIR}/deploy/install-employment.sh" "${SCRIPTS_DIR}/install-employment.sh"
  fi

  # 9b. Write hardened systemd unit
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Employment Recruitment Platform (Dasteva Full-Stack Express + SQLite)
Documentation=https://github.com/khalildelavaran/employment
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${APP_DIR}/node_modules/.bin/tsx ${APP_DIR}/server.ts
Restart=on-failure
RestartSec=5
TimeoutStartSec=30
TimeoutStopSec=15
KillSignal=SIGTERM

# Security Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictSUIDSGID=true
ReadWritePaths=${DATA_DIR}

# Logging via systemd journal
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

  chmod 644 "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}.service"
  log_info "Configured and enabled systemd unit /etc/systemd/system/${SERVICE_NAME}.service."

  # 9c. Configure Nginx Reverse Proxy
  local nginx_site="/etc/nginx/sites-available/${APP_NAME}"
  local nginx_link="/etc/nginx/sites-enabled/${APP_NAME}"

  cat > "${nginx_site}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Match Express JSON payload limit (10mb) with safety headroom
    client_max_body_size 12m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    access_log ${LOG_DIR}/nginx-access.log;
    error_log  ${LOG_DIR}/nginx-error.log warn;

    # Proxy all traffic to local Node.js/Express backend
    location / {
        proxy_pass http://${APP_HOST}:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 15s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

  ln -sf "${nginx_site}" "${nginx_link}"
  if [[ -L /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
    log_info "Removed default Nginx welcome site."
  fi

  nginx -t
  systemctl enable nginx
  systemctl reload-or-restart nginx
  log_info "Nginx reverse proxy validated and reloaded."

  # 9d. Optional Let's Encrypt HTTPS via Certbot
  if [[ "${ENABLE_SSL}" == "true" ]]; then
    log_info "Requesting/renewing Let's Encrypt HTTPS certificate for ${DOMAIN}..."
    certbot --nginx \
      --non-interactive \
      --agree-tos \
      --email "${SSL_EMAIL}" \
      --domains "${DOMAIN}" \
      --redirect
    systemctl enable certbot.timer 2>/dev/null || true
    log_info "Certbot HTTPS configured for ${DOMAIN}."
  fi

  # 9e. Configure UFW Firewall (ensure SSH stays open)
  if [[ "${SKIP_UFW}" != "true" ]]; then
    log_info "Configuring UFW firewall rules (OpenSSH + Nginx Full)..."
    ufw allow OpenSSH >/dev/null
    ufw allow 'Nginx Full' >/dev/null
    if ufw status | grep -qi "Status: inactive"; then
      ufw --force enable >/dev/null
      log_info "UFW firewall enabled."
    else
      log_info "UFW firewall already active; rules ensured."
    fi
  else
    log_info "Skipping UFW firewall configuration (--skip-ufw)."
  fi
}

# ------------------------------------------------------------------------------
# Stage 10: Start Service, Health Verification & Persist Install State
# ------------------------------------------------------------------------------
stage_start_and_verify() {
  stage_start "10/10 — Starting Service, Running Health Checks & Saving State"

  systemctl restart "${SERVICE_NAME}.service"

  local health_url="http://${APP_HOST}:${APP_PORT}/api/health"
  local ok="false"
  local response=""
  for i in $(seq 1 20); do
    if response="$(curl -fsS --max-time 5 "${health_url}" 2>/dev/null)"; then
      if echo "${response}" | grep -q '"status":"ok"' && echo "${response}" | grep -q '"db":"ok"'; then
        ok="true"
        break
      fi
    fi
    sleep 1
  done

  if [[ "${ok}" != "true" ]]; then
    log_error "Health check failed on ${health_url} after 20 seconds."
    systemctl status "${SERVICE_NAME}.service" --no-pager || true
    journalctl -u "${SERVICE_NAME}.service" -n 40 --no-pager || true
    exit 1
  fi

  log_info "Backend health check passed: ${response}"

  # Verify Nginx reverse proxy connectivity locally
  if curl -fsS --max-time 5 -H "Host: ${DOMAIN}" "http://127.0.0.1/api/health" >/dev/null 2>&1; then
    log_info "Nginx reverse proxy health check passed."
  else
    log_warn "Direct HTTP check through Nginx returned non-200 (expected if HTTPS redirect is active)."
  fi

  local installed_commit
  installed_commit="$(git -C "${APP_DIR}" rev-parse HEAD)"

  cat > "${STATE_FILE}" <<EOF
APP_NAME=${APP_NAME}
SERVICE_NAME=${SERVICE_NAME}
SERVICE_USER=${SERVICE_USER}
SERVICE_GROUP=${SERVICE_GROUP}
INSTALL_DIR=${INSTALL_DIR}
APP_DIR=${APP_DIR}
SCRIPTS_DIR=${SCRIPTS_DIR}
CONFIG_DIR=${CONFIG_DIR}
ENV_FILE=${ENV_FILE}
SSH_CONFIG_PATH=${SSH_CONFIG_PATH}
SSH_KEY_PATH=${SSH_KEY_PATH}
DATA_DIR=${DATA_DIR}
DB_FILE=${DB_FILE}
STATE_DIR=${STATE_DIR}
LOG_DIR=${LOG_DIR}
BACKUP_DIR=${BACKUP_DIR}
REPO_SSH=${REPO_SSH}
REPO_BRANCH=${REPO_BRANCH}
APP_HOST=${APP_HOST}
APP_PORT=${APP_PORT}
DOMAIN=${DOMAIN}
INSTALLED_COMMIT=${installed_commit}
LAST_DEPLOYED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
EOF

  chown root:"${SERVICE_GROUP}" "${STATE_FILE}"
  chmod 640 "${STATE_FILE}"

  echo ""
  echo "=============================================================================="
  echo "Employment Platform Installation Completed Successfully!"
  echo "=============================================================================="
  echo "  Installed Commit : $(git -C "${APP_DIR}" rev-parse --short HEAD) (${REPO_BRANCH})"
  echo "  Service Status   : $(systemctl is-active "${SERVICE_NAME}.service")"
  echo "  Health Endpoint  : ${health_url}"
  echo "  Environment File : ${ENV_FILE}"
  echo "  SQLite Database  : ${DB_FILE}"
  echo "  Update Command   : sudo employment-update"
  echo "  Install Log      : ${LOG_FILE}"
  echo ""
  echo "Next Step (if SMS notifications are enabled):"
  echo "  1. Edit ${ENV_FILE} and set FARAZSMS_API_KEY"
  echo "  2. Restart service: sudo systemctl restart ${SERVICE_NAME}"
  echo "=============================================================================="
}

# ------------------------------------------------------------------------------
# Main Execution Flow
# ------------------------------------------------------------------------------
main() {
  init_logging
  log_info "Starting Employment Platform production installation..."
  stage_preflight
  stage_system_packages
  stage_nodejs
  stage_directories_and_user
  stage_github_ssh
  stage_fetch_source
  stage_environment_config
  stage_build_and_migrate
  stage_services_and_proxy
  stage_start_and_verify
}

main "$@"
