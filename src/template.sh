#!/bin/bash

set -e

function contains() {
  match="$1"
  shift
  for e in "$@"; do
    if [ "$e" == "$match" ]; then
      return 0
    fi
  done
  return 1
}

# main

HLINE="================================================================================"

DATA_PREFIX="/etc/test-script-data" # TODO: make this customizable
STATE_FOLDER="$DATA_PREFIX/state"

mainEntry() {
  mkdir -p "$STATE_FOLDER"

  CRON_FILE=$(mktemp)

  echo "-$-CRONSCRIPT-$-" | base64 -d > "$CRON_FILE"
}

cronEntry() {
  headingMain 'Running Cron'
}

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
  safeexec test -e "$STATE_FOLDER/${SCRIPT_ID}_installed"
  return $ex
}

getInstalledStatusEcho() {
  safeexec test -e "$STATE_FOLDER/${SCRIPT_ID}_installed"
  if [ $ex -ne 0 ]; then
    echo false
  else
    echo true
  fi
}

getInstalledSteps() {
  dir -w 1 "$STATE_FOLDER" | grep "^step_${SCRIPT_ID}_" | sed "s|^step_${SCRIPT_ID}_||g"
}

isStepInstalled() {
  safeexec test -e "$STATE_FOLDER/step_${SCRIPT_ID}_${STEP_ID}_installed"
  return $ex
}

postRun() {
  mv "$CRON_FILE" "$DATA_PREFIX/cron.sh"
  headingMain "DONE!"
}
