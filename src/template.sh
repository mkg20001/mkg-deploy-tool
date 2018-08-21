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

DATA_PREFIX="#DATAPREFIX-DPLTOOL#" # TODO: make this customizable
STATE_FOLDER="$DATA_PREFIX/state"

mainEntry() {
  mkdir -p "$STATE_FOLDER"

  CRON_FILE=$(mktemp)

  echo "-$-CRONSCRIPT-$-" | base64 -d > "$CRON_FILE"
}

mainPost() {
  echo "cronPost" >> "$CRON_FILE"
  mv "$CRON_FILE" "$DATA_PREFIX/cron.sh"
  headingMain "DONE!"
}

cronEntry() {
  headingMain 'Running Cron'
}

cronPost() {
  headingMain "DONE!"
}

safeexec() {
  ex=0
  "$@" || ex=$?
}

heading() {
  echo -e "\n$HLINE\n$*\n$HLINE\n"
}

headingMain() {
  echo -e "\n\n$HLINE\n *** $* *** \n$HLINE\n\n"
}

# statesave
# scripts/installed/$SCRIPT_ID        -> is installed
# scripts/uninstall/$SCRIPT_ID        -> uninstall info
# steps/$SCRIPT_ID/installed/$STEP_ID -> is step installed
# steps/$SCRIPT_ID/uninstall/$STEP_ID -> uninstall info

stateFnc() {
  case $1 in
    script)
      path="$STATE_FOLDER/scripts/$2/$SCRIPT_ID"
      ;;
    step)
      path="$STATE_FOLDER/steps/$2/$SCRIPT_ID/$STEP_ID"
      ;;
  esac

  case $3 in
    set)
      shift 3
      mkdir -p "$(dirname $path)"
      echo "$@" > "$path"
      ;;
    exists)
      safeexec test -e "$path"
      return $ex
      ;;
    get)
      cat "$path"
      ;;
    ls)
      dir -w 1 "$(dirname $path)"
      ;;
    rm)
      rm -f "$path"
      ;;
    rmr)
      rm -rf "$(dirname $path)"
      ;;
    path)
      mkdir -p "$(dirname $path)"
      echo "$path"
      ;;
  esac
}

getVersion() {
  safeexec stateFnc script installed get 2> /dev/null
}

getStepVersion() {
  safeexec stateFnc step installed get 2> /dev/null
}

isScriptInstalled() {
  safeexec stateFnc script installed exists
  return $ex
}

isScriptInstalledAsEcho() {
  safeexec stateFnc script installed exists
  if [ $ex -ne 0 ]; then
    echo false
  else
    echo true
  fi
}

getInstalledScripts() {
#  safeexec stateFnc script installed ls 2> /dev/null
  dir -w 1 "$STATE_FOLDER/scripts/installed" 2> /dev/null || true
}

isStepInstalled() {
  safeexec stateFnc step installed exists
  return $ex
}

isStepInstalledAsEcho() {
  safeexec stateFnc step installed exists
  if [ $ex -ne 0 ]; then
    echo false
  else
    echo true
  fi
}

getInstalledSteps() {
  safeexec stateFnc step installed ls 2> /dev/null
}
