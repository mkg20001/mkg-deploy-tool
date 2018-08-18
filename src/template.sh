#!/bin/bash

# https://stackoverflow.com/a/8574392
function contains() {
  local e match="$1"
  shift
  for e; do [[ "$e" == "$match" ]] && return 0; done
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

headingMain() {
  echo -e "\n\n$HLINE\n *** $* *** \n$HLINE\n\n"
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
