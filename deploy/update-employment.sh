#!/usr/bin/env bash
# ==============================================================================
# Employment Platform — Production Updater & Rollback Script (from GitHub)
# Repository: https://github.com/khalildelavaran/employment
# ==============================================================================
# Checks GitHub for new commits, creates an atomic SQLite WAL + config + build
# backup, pulls updates without touching secrets or user data, builds frontend
# BEFORE restarting the service, runs SQLite migrations, verifies /api/health,
# and automatically rolls back if any post-change step fails.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

STATE_FILE="${STATE_FILE:-/var/lib/employment/install-state.env}"
LOCK_FILE="/run/employment-update.lock"

# Defaults (overridden by install-state.env and CLI flags)
APP_NAME="employment"
SERVICE_NAME="employment"
SERVICE_USER="employment"
SERVICE_GROUP="employment"
INSTALL_DIR="/opt/employment"
APP_DIR="/opt/employment/app"
SCRIPTS_DIR="/opt/employment/scripts"
CONFIG_DIR="/etc/employment"
ENV_FILE="/etc/employment/employment.env"
SSH_CONFIG_PATH="/etc/employment/ssh/config"
DATA_DIR="/var/lib/employment/data"
DB_FILE="/var/lib/employment/data/dasteva_d1.sqlite"
STATE_DIR="/var/lib/employment"
LOG_DIR="/var/log/employment"
BACKUP_DIR="/var/backups/employment"
REPO_BRANCH="main"
APP_HOST="127.0.0.1"
APP_PORT="3000"

FORCE_UPDATE="false"
DRY_RUN="false"
LIST_BACKUPS="false"
ROLLBACK_MODE="false"
ROLLBACK_TARGET=""
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
BRANCH_OVERRIDE=""

CURRENT_STAGE="Initialization"
LOG_FILE=""
ACTIVE_SNAPSHOT_DIR=""
MUTATED_CODE="false"
MUTATED_DB="false"
ROLLBACK_IN_PROGRESS="false"

usage() {
  cat <<'EOF'
Usage: sudo ./update-employment.sh [OPTIONS]

Options:
  --branch NAME            Override Git branch to pull (default: installed branch)
  --force                  Rebuild and redeploy even if already on latest commit
  --dry-run                Show pending GitHub commits without making any changes
  --keep-backups N         Number of backup snapshots to retain (default: 10)
  --list-backups           List available backup snapshots for rollback
  --rollback [PATH]        Roll back to the latest snapshot (or specified snapshot path)
  --state-file PATH        Path to install-state.env (default: /var/lib/employment/install-state.env)
  -h, --help               Show this help message

Examples:
  sudo employment-update
  sudo employment-update --dry-run
  sudo employment-update --list-backups
  sudo employment-update --rollback
  sudo employment-update --rollback /var/backups/employment/backup-20261122-140500
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)       BRANCH_OVERRIDE="$2"; shift 2 ;;
    --force)        FORCE_UPDATE="true"; shift ;;
    --dry-run)      DRY_RUN="true"; shift ;;
    --keep-backups) KEEP_BACKUPS="$2"; shift 2 ;;
    --list-backups) LIST_BACKUPS="true"; shift ;;
    --rollback)
      ROLLBACK_MODE="true"
      if [[ $# -ge 2 && "${2}" != --* ]]; then
        ROLLBACK_TARGET="$2"
        shift 2
      else
        shift
      fi
      ;;
    --state-file)   STATE_FILE="$2"; shift 2 ;;
    -h|--help)      usage; exit 0 ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Load saved installation paths if present
if [[ -f "${STATE_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${STATE_FILE}"
fi

if [[ -n "${BRANCH_OVERRIDE}" ]]; then
  REPO_BRANCH="${BRANCH_OVERRIDE}"
fi

# Resolve DB_PATH from ENV_FILE if customized after install
if [[ -f "${ENV_FILE}" ]]; then
  env_db_path="$(grep -E '^DB_PATH=' "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)"
  if [[ -n "${env_db_path}" ]]; then
    DB_FILE="${env_db_path}"
  fi
  env_port="$(grep -E '^PORT=' "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)"
  if [[ -n "${env_port}" ]]; then
    APP_PORT="${env_port}"
  fi
  env_host="$(grep -E '^HOST=' "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)"
  if [[ -n "${env_host}" ]]; then
    APP_HOST="${env_host}"
  fi
fi

# ------------------------------------------------------------------------------
# Logging, Lock & Helpers
# ------------------------------------------------------------------------------
timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

init_logging() {
  mkdir -p "${LOG_DIR}"
  LOG_FILE="${LOG_DIR}/update-$(date '+%Y%m%d-%H%M%S').log"
  touch "${LOG_FILE}"
  chmod 640 "${LOG_FILE}"
  exec > >(tee -a "${LOG_FILE}") 2>&1
}

log_info()  { echo "[$(timestamp)] [INFO]  $*"; }
log_warn()  { echo "[$(timestamp)] [WARN]  $*"; }
log_error() { echo "[$(timestamp)] [ERROR] $*" >&2; }

stage_start() {
  CURRENT_STAGE="$1"
  echo ""
  echo "=============================================================================="
  echo "[$(timestamp)] STAGE: ${CURRENT_STAGE}"
  echo "=============================================================================="
}

run_as_app_user() {
  sudo -u "${SERVICE_USER}" -H -- "$@"
}

acquire_lock() {
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log_error "Another Employment update or rollback is currently running (lock: ${LOCK_FILE})."
    exit 1
  fi
}

verify_health() {
  local health_url="http://${APP_HOST}:${APP_PORT}/api/health"
  local response=""
  for _ in $(seq 1 20); do
    if response="$(curl -fsS --max-time 5 "${health_url}" 2>/dev/null)"; then
      if echo "${response}" | grep -q '"status":"ok"' && echo "${response}" | grep -q '"db":"ok"'; then
        log_info "Health check PASSED: ${response}"
        return 0
      fi
    fi
    sleep 1
  done
  log_error "Health check FAILED on ${health_url} after 20s."
  return 1
}

# ------------------------------------------------------------------------------
# Backup Management & Rollback Engine
# ------------------------------------------------------------------------------
list_available_backups() {
  if [[ ! -d "${BACKUP_DIR}" ]]; then
    echo "No backup directory found at ${BACKUP_DIR}."
    return 0
  fi

  local found="false"
  echo "Available Employment Backup Snapshots in ${BACKUP_DIR}:"
  echo "------------------------------------------------------------------------------"
  while IFS= read -r dir; do
    [[ -z "${dir}" ]] && continue
    found="true"
    local prev_commit="unknown"
    local created_at="unknown"
    if [[ -f "${dir}/metadata.env" ]]; then
      prev_commit="$(grep '^PREV_COMMIT=' "${dir}/metadata.env" | cut -d'=' -f2- || echo unknown)"
      created_at="$(grep '^CREATED_AT=' "${dir}/metadata.env" | cut -d'=' -f2- || echo unknown)"
    fi
    printf "  %-52s commit=%-10s created=%s\n" "${dir}" "${prev_commit:0:8}" "${created_at}"
  done < <(find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' | sort -r)

  if [[ "${found}" == "false" ]]; then
    echo "  (none)"
  fi
}

create_pre_update_backup() {
  local prev_commit="$1"
  local target_commit="$2"
  local snap_name="backup-$(date '+%Y%m%d-%H%M%S')"
  local snap_dir="${BACKUP_DIR}/${snap_name}"

  install -d -m 0750 -o root -g "${SERVICE_GROUP}" "${snap_dir}"

  # 1. Atomic online SQLite WAL backup using sqlite3 .backup
  if [[ -f "${DB_FILE}" ]]; then
    log_info "Creating atomic SQLite backup from ${DB_FILE}..."
    sqlite3 "${DB_FILE}" ".timeout 15000" ".backup '${snap_dir}/dasteva_d1.sqlite'"
    local integrity
    integrity="$(sqlite3 "${snap_dir}/dasteva_d1.sqlite" "PRAGMA integrity_check;")"
    if [[ "${integrity}" != "ok" ]]; then
      log_error "Backup SQLite integrity check failed (${integrity}). Aborting update!"
      exit 1
    fi
    chmod 640 "${snap_dir}/dasteva_d1.sqlite"
    log_info "SQLite backup verified (integrity_check=ok)."
  else
    log_warn "Database file ${DB_FILE} does not exist yet; skipping DB backup."
  fi

  # 2. Backup protected environment file
  if [[ -f "${ENV_FILE}" ]]; then
    cp -p "${ENV_FILE}" "${snap_dir}/employment.env"
    chmod 600 "${snap_dir}/employment.env"
  fi

  # 3. Backup current frontend build (dist/) for fast rollback
  if [[ -d "${APP_DIR}/dist" ]]; then
    tar -czf "${snap_dir}/dist.tar.gz" -C "${APP_DIR}" dist
  fi

  # 4. Save package.json hash to detect if rollback needs npm install
  local pkg_sha=""
  if [[ -f "${APP_DIR}/package.json" ]]; then
    pkg_sha="$(sha256sum "${APP_DIR}/package.json" | awk '{print $1}')"
  fi

  cat > "${snap_dir}/metadata.env" <<EOF
PREV_COMMIT=${prev_commit}
TARGET_COMMIT=${target_commit}
REPO_BRANCH=${REPO_BRANCH}
DB_FILE=${DB_FILE}
PKG_SHA256=${pkg_sha}
CREATED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
EOF
  chmod 640 "${snap_dir}/metadata.env"

  ACTIVE_SNAPSHOT_DIR="${snap_dir}"
  log_info "Pre-update snapshot created at: ${ACTIVE_SNAPSHOT_DIR}"

  # Rotate old backups
  if [[ "${KEEP_BACKUPS}" =~ ^[0-9]+$ ]] && (( KEEP_BACKUPS > 0 )); then
    local old_dirs
    old_dirs="$(find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' | sort -r | tail -n "+$((KEEP_BACKUPS + 1))")"
    if [[ -n "${old_dirs}" ]]; then
      while IFS= read -r old_dir; do
        [[ -n "${old_dir}" ]] && rm -rf "${old_dir}" && log_info "Pruned old backup: ${old_dir}"
      done <<< "${old_dirs}"
    fi
  fi
}

perform_rollback() {
  local snap_dir="$1"
  local restore_db="${2:-true}"

  if [[ -z "${snap_dir}" || ! -d "${snap_dir}" || ! -f "${snap_dir}/metadata.env" ]]; then
    log_error "Invalid rollback snapshot directory: '${snap_dir}'."
    return 1
  fi

  ROLLBACK_IN_PROGRESS="true"
  log_warn "=============================================================================="
  log_warn "INITIATING ROLLBACK FROM SNAPSHOT: ${snap_dir}"
  log_warn "=============================================================================="

  # shellcheck disable=SC1090
  source "${snap_dir}/metadata.env"

  if [[ -z "${PREV_COMMIT:-}" ]]; then
    log_error "PREV_COMMIT missing in ${snap_dir}/metadata.env."
    return 1
  fi

  local need_service_restart="false"
  if [[ "${restore_db}" == "true" ]]; then
    log_info "Stopping ${SERVICE_NAME}.service before restoring SQLite database..."
    systemctl stop "${SERVICE_NAME}.service" || true
    need_service_restart="true"
  fi

  # 1. Restore git commit
  log_info "Reverting source code in ${APP_DIR} to commit ${PREV_COMMIT}..."
  git config --system --add safe.directory "${APP_DIR}" 2>/dev/null || true
  git -C "${APP_DIR}" reset --hard "${PREV_COMMIT}"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"

  # 2. Reinstall dependencies if package.json changed
  local current_pkg_sha=""
  if [[ -f "${APP_DIR}/package.json" ]]; then
    current_pkg_sha="$(sha256sum "${APP_DIR}/package.json" | awk '{print $1}')"
  fi
  if [[ -n "${PKG_SHA256:-}" && "${current_pkg_sha}" != "${PKG_SHA256}" ]] || [[ ! -d "${APP_DIR}/node_modules" ]]; then
    log_info "Restoring dependencies for previous commit..."
    local npm_cache_dir="${STATE_DIR}/.npm-cache"
    install -d -m 0750 -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${npm_cache_dir}"
    run_as_app_user env HOME="${STATE_DIR}" npm_config_cache="${npm_cache_dir}" \
      npm --prefix "${APP_DIR}" install --no-audit --no-fund
  fi

  # 3. Restore previous dist/ build
  if [[ -f "${snap_dir}/dist.tar.gz" ]]; then
    log_info "Restoring previous dist/ bundle..."
    rm -rf "${APP_DIR}/dist"
    tar -xzf "${snap_dir}/dist.tar.gz" -C "${APP_DIR}"
    chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}/dist"
  else
    log_info "Rebuilding frontend for previous commit..."
    run_as_app_user env HOME="${STATE_DIR}" NODE_ENV=production \
      npm --prefix "${APP_DIR}" run build
  fi

  # 4. Restore SQLite database snapshot safely (cleaning stale WAL/SHM files)
  if [[ "${restore_db}" == "true" && -f "${snap_dir}/dasteva_d1.sqlite" ]]; then
    log_info "Restoring SQLite database to ${DB_FILE}..."
    rm -f "${DB_FILE}-wal" "${DB_FILE}-shm"
    cp -f "${snap_dir}/dasteva_d1.sqlite" "${DB_FILE}"
    local integrity
    integrity="$(sqlite3 "${DB_FILE}" "PRAGMA integrity_check;")"
    if [[ "${integrity}" != "ok" ]]; then
      log_error "Restored database failed integrity_check: ${integrity}"
      return 1
    fi
    chown "${SERVICE_USER}:${SERVICE_GROUP}" "${DB_FILE}"
    chmod 640 "${DB_FILE}"
    log_info "SQLite database restored and verified."
  fi

  # 5. Restart service if needed & verify health
  if [[ "${need_service_restart}" == "true" ]] || ! systemctl is-active --quiet "${SERVICE_NAME}.service"; then
    log_info "Starting ${SERVICE_NAME}.service after rollback..."
    systemctl restart "${SERVICE_NAME}.service"
  fi

  if verify_health; then
    log_warn "ROLLBACK COMPLETED SUCCESSFULLY! Restored commit ${PREV_COMMIT:0:8}."
    return 0
  else
    log_error "Service health check still failed after rollback! Check: journalctl -u ${SERVICE_NAME} -n 50"
    return 1
  fi
}

on_error() {
  local exit_code="$?"
  local line_no="${1:-unknown}"
  log_error "Update failed during stage '${CURRENT_STAGE}' at line ${line_no} (exit=${exit_code})."

  if [[ "${ROLLBACK_IN_PROGRESS}" != "true" && -n "${ACTIVE_SNAPSHOT_DIR}" && "${MUTATED_CODE}" == "true" ]]; then
    log_warn "Attempting automatic rollback using ${ACTIVE_SNAPSHOT_DIR}..."
    if perform_rollback "${ACTIVE_SNAPSHOT_DIR}" "${MUTATED_DB}"; then
      log_warn "System was safely rolled back to previous working state."
    else
      log_error "Automatic rollback encountered an error. Inspect ${LOG_FILE} immediately."
    fi
  fi

  exit "${exit_code}"
}

trap 'on_error ${LINENO}' ERR

# ------------------------------------------------------------------------------
# Main Flows
# ------------------------------------------------------------------------------
main() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: This script must be executed as root (use: sudo $0)." >&2
    exit 1
  fi

  if [[ "${LIST_BACKUPS}" == "true" ]]; then
    list_available_backups
    exit 0
  fi

  init_logging
  acquire_lock

  # Manual Rollback Flow
  if [[ "${ROLLBACK_MODE}" == "true" ]]; then
    stage_start "Manual Rollback"
    if [[ -z "${ROLLBACK_TARGET}" ]]; then
      ROLLBACK_TARGET="$(find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' | sort -r | head -n 1 || true)"
    fi
    if [[ -z "${ROLLBACK_TARGET}" ]]; then
      log_error "No backup snapshots available in ${BACKUP_DIR}."
      exit 1
    fi
    perform_rollback "${ROLLBACK_TARGET}" "true"
    exit 0
  fi

  # Standard Update Flow
  stage_start "1/7 — Checking Installed Version & Remote GitHub Updates (${REPO_BRANCH})"
  if [[ ! -d "${APP_DIR}/.git" ]]; then
    log_error "Git repository not found at ${APP_DIR}. Run install-employment.sh first."
    exit 1
  fi
  if [[ ! -f "${SSH_CONFIG_PATH}" ]]; then
    log_error "SSH config not found at ${SSH_CONFIG_PATH}. Run install-employment.sh first."
    exit 1
  fi

  git config --system --add safe.directory "${APP_DIR}" 2>/dev/null || true

  # Ensure [ssh.github.com]:443 host key is pinned in known_hosts
  local ssh_dir
  ssh_dir="$(dirname "${SSH_CONFIG_PATH}")"
  local known_hosts_file="${ssh_dir}/known_hosts"
  if [[ -f "${known_hosts_file}" ]] && ! grep -q '^\[ssh\.github\.com\]:443 ' "${known_hosts_file}" 2>/dev/null; then
    echo "[ssh.github.com]:443 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" >> "${known_hosts_file}"
  fi

  local git_ssh_cmd="ssh -F ${SSH_CONFIG_PATH} -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"

  local current_commit remote_commit
  current_commit="$(git -C "${APP_DIR}" rev-parse HEAD)"

  log_info "Fetching latest commits from GitHub (branch: ${REPO_BRANCH})..."
  if ! timeout 120 env GIT_SSH_COMMAND="${git_ssh_cmd}" git -C "${APP_DIR}" fetch --progress --prune origin "${REPO_BRANCH}"; then
    log_warn "Git fetch timed out or failed with current SSH config; switching ${SSH_CONFIG_PATH} to ssh.github.com:443 and retrying..."
    sed -i 's/HostName github.com/HostName ssh.github.com\n  Port 443/' "${SSH_CONFIG_PATH}" 2>/dev/null || true
    timeout 120 env GIT_SSH_COMMAND="${git_ssh_cmd}" git -C "${APP_DIR}" fetch --progress --prune origin "${REPO_BRANCH}"
  fi
  remote_commit="$(git -C "${APP_DIR}" rev-parse "origin/${REPO_BRANCH}")"

  log_info "Current installed commit : ${current_commit:0:8}"
  log_info "Latest GitHub commit     : ${remote_commit:0:8}"

  if [[ "${current_commit}" == "${remote_commit}" && "${FORCE_UPDATE}" != "true" ]]; then
    log_info "Employment is already up to date (${current_commit:0:8}). No action required."
    exit 0
  fi

  if [[ "${current_commit}" != "${remote_commit}" ]]; then
    log_info "Incoming commits:"
    git -C "${APP_DIR}" log --oneline "${current_commit}..${remote_commit}" | sed 's/^/    /'
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "Dry-run completed. No files or services were modified."
    exit 0
  fi

  stage_start "2/7 — Creating Pre-Update Backup Snapshot"
  create_pre_update_backup "${current_commit}" "${remote_commit}"

  stage_start "3/7 — Pulling New Release from GitHub (Preserving Config & Data)"
  local old_pkg_hash=""
  [[ -f "${APP_DIR}/package.json" ]] && old_pkg_hash="$(sha256sum "${APP_DIR}/package.json" | awk '{print $1}')"

  MUTATED_CODE="true"
  git -C "${APP_DIR}" checkout -B "${REPO_BRANCH}" "origin/${REPO_BRANCH}"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"
  log_info "Checked out commit ${remote_commit:0:8}. Protected files (${ENV_FILE}, ${DB_FILE}) untouched."

  stage_start "4/7 — Updating Dependencies & Building Frontend (Live Service Still Running)"
  local npm_cache_dir="${STATE_DIR}/.npm-cache"
  install -d -m 0750 -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${npm_cache_dir}"

  local new_pkg_hash=""
  [[ -f "${APP_DIR}/package.json" ]] && new_pkg_hash="$(sha256sum "${APP_DIR}/package.json" | awk '{print $1}')"

  if [[ "${old_pkg_hash}" != "${new_pkg_hash}" || "${FORCE_UPDATE}" == "true" || ! -d "${APP_DIR}/node_modules" ]]; then
    if [[ -f "${APP_DIR}/package-lock.json" ]]; then
      log_info "Dependencies changed; running 'npm ci'..."
      run_as_app_user env HOME="${STATE_DIR}" npm_config_cache="${npm_cache_dir}" \
        npm --prefix "${APP_DIR}" ci --no-audit --no-fund
    else
      log_info "Dependencies changed; running 'npm install'..."
      run_as_app_user env HOME="${STATE_DIR}" npm_config_cache="${npm_cache_dir}" \
        npm --prefix "${APP_DIR}" install --no-audit --no-fund
    fi
  else
    log_info "package.json unchanged; skipping full npm install."
  fi

  log_info "Rebuilding React/Vite production bundle (dist/)..."
  run_as_app_user env HOME="${STATE_DIR}" NODE_ENV=production \
    npm --prefix "${APP_DIR}" run build

  if [[ ! -f "${APP_DIR}/dist/index.html" ]]; then
    log_error "Build verification failed: ${APP_DIR}/dist/index.html missing."
    exit 1
  fi

  stage_start "5/7 — Running SQLite Database Migrations"
  MUTATED_DB="true"
  if [[ -f "${APP_DIR}/scripts/migrate-db.ts" ]]; then
    run_as_app_user bash -c "set -a; source '${ENV_FILE}'; set +a; cd '${APP_DIR}' && ./node_modules/.bin/tsx scripts/migrate-db.ts"
  else
    log_info "No standalone migrate script in release; schema migrations will run on boot."
  fi

  stage_start "6/7 — Restarting Service with Minimal Downtime"
  systemctl restart "${SERVICE_NAME}.service"

  stage_start "7/7 — Post-Update Health Verification & Cleanup"
  if ! verify_health; then
    log_error "Post-update health check failed!"
    exit 1
  fi

  # Sync latest updater script if updated in GitHub
  if [[ -f "${APP_DIR}/deploy/update-employment.sh" ]]; then
    install -m 0750 -o root -g "${SERVICE_GROUP}" "${APP_DIR}/deploy/update-employment.sh" "${SCRIPTS_DIR}/update-employment.sh"
  fi

  # Update install-state.env commit metadata
  if [[ -f "${STATE_FILE}" ]]; then
    sed -i "s|^INSTALLED_COMMIT=.*|INSTALLED_COMMIT=${remote_commit}|" "${STATE_FILE}" || true
    sed -i "s|^LAST_DEPLOYED_AT=.*|LAST_DEPLOYED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')|" "${STATE_FILE}" || true
  fi

  echo ""
  echo "=============================================================================="
  echo "Employment Platform Updated Successfully!"
  echo "=============================================================================="
  echo "  Previous Commit : ${current_commit:0:8}"
  echo "  Active Commit   : ${remote_commit:0:8} (${REPO_BRANCH})"
  echo "  Backup Snapshot : ${ACTIVE_SNAPSHOT_DIR}"
  echo "  Update Log      : ${LOG_FILE}"
  echo "=============================================================================="
}

main "$@"
