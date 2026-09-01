#!/bin/bash

export VITE_WINGOSY_DEBUG=1
LOG_PATH="$PWD/.scratch/logs"
LOG_NAME="$(date +%s).log"
FULL_LOG_PATH="$LOG_PATH/$LOG_NAME"

mkdir -p "$LOG_PATH"

exec > >(tee "$FULL_LOG_PATH") 2>&1

echo "running"

bun run dev
