#!/bin/bash

# https://stackoverflow.com/q/3685970/3990041
function contains() {
    local n=$#
    local value=${!n}
    for ((i=1;i < $#;i++)) {
        if [ "${!i}" == "${value}" ]; then
            return 0
        fi
    }
    return 1
}

# main
DATA_PREFIX="/etc/test-script-data" # TODO: make this customizable
STATE_FOLDER="$DATA_PREFIX/state"
mkdir -p "$STATE_FOLDER"

HLINE="================================================================================"

safeexec() {
  ex=0
  "$@" || ex=$?
}

heading() {
  echo -e "\n\n$HLINE\n$*\n$HLINE\n\n"
}

getVersion() {
  cat "$STATE_FOLDER/${SCRIPT_ID}_installed"
}

getInstalledStatus() {
  safeexec test -e "$STEP_FOLDER/${SCRIPT_ID}_installed"
  return $ex
}

getInstalledSteps() {
  dir -w 1 "$STATE_FOLDER" | grep "^step_${SCRIPT_ID}_"
}

isStepInstalled() {
  safeexec test -e "$STEP_FOLDER/step_${SCRIPT_ID}_$1_installed"
  return $ex
}