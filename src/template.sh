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

# because npm
export SUDO_GID=
export SUDO_COMMAND=
export SUDO_USER=
export SUDO_UID=
export HOME=/root

HLINE="================================================================================"
HOSTNAME=$(hostname)

DATA_PREFIX="#DATAPREFIX-DPLTOOL#" # TODO: make this customizable
STATE_FOLDER="$DATA_PREFIX/state"
CACHE="$DATA_PREFIX/cache"

cmnEntry() {
  mkdir -p "$STATE_FOLDER"
  mkdir -p "$CACHE"
  find "$CACHE" -mtime +1 -delete
}

mainEntry() {
  cmnEntry

  CRON_FILE=$(mktemp)

  echo "-$-CRONSCRIPT-$-" | base64 -d > "$CRON_FILE"
}

mainPost() {
  echo "cronPost" >> "$CRON_FILE"
  mv "$CRON_FILE" "$DATA_PREFIX/cron.sh"
  headingMain "DONE!"
}

cronEntry() {
  cmnEntry

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

# backup

LIST=()
RM_LIST=()
BAK_RM_FILE=false

_append_backup() {
  comp="$1"
  shift
  type="$1"
  shift

  found=false

  for f in "$@"; do
    if test "-$comp" "$f"; then
      echo "backup->$SCRIPT_NAME: Include $type '$f' in backup..."
      LIST+=("$f")
      if $BAK_RM_FILE; then
        echo "backup->$SCRIPT_NAME: Include $type '$f' for post-backup deletion..."
        RM_LIST+=("$f")
      fi
      found=true
    fi
  done

  if ! $found; then
    echo "backup->$SCRIPT_NAME: ERROR: Did not find anything for glob $SCRIPT_NAME->'$CURRENT_GLOB'" 2>&1
    exit 2
  fi
}

backup_append_files() {
  _append_backup "f" "file" "$@"
}

backup_append_folders() {
  _append_backup "d" "folder" "$@"
}

backup_append_items() {
  _append_backup "e" "item" "$@"
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

# cache

cachename() {
  name=$(echo "$1" | sed -r "s|[^a-z0-9A-Z]|_|g")
  cpath="$CACHE/$name"
}

get_cache() {
  cachename "$1"
  cat "$cpath"
}

has_cache() {
  cachename "$1"
  safeexec test -e "$cpath"
  return $ex
}

set_cache() {
  cachename "$1"
  touch "$cpath"
}

with_cache() {
  cachename "$1"
  shift
  if [ ! -e "$cpath" ]; then
    safeexec "$@"
    if [ "$ex" == "0" ]; then
      touch "$cpath"
    fi
    return $ex
  fi
}

# git

git_get_commit() {
  git -C "$1" rev-parse --verify HEAD
}

git_pull() {
  curC=$(git_get_commit "$1")
  git -C "$1" pull
  newC=$(git_get_commit "$1")

  safexec "$curC" == "$newC"
  return $ex
}

# docker

_docker_req() {
  curl_cached "$1" -H "Authorization: Bearer $DTOK"
}

docker_get_token() {
  DTOK=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=$1" | jq -r .token)
}

docker_get_img_repo_hash() {
  url="https://registry.hub.docker.com/v2/$1/manifests/$2"
  cachename "$url"
  if [ ! -e "$cpath" ]; then
    docker_get_token "repository:$1:pull"
  fi
  # _docker_req "https://registry.hub.docker.com/v2/$1/manifests/$2" -I | grep "Etag" | grep -o "[a-z0-9]*:[a-z0-9]*" | tail -n 1
  _docker_req "$url" | jq -r ".history[0].v1Compatibility" | jq -r ".container"
}

docker_get_img_local_hash() {
  # docker image inspect "$1:$2" | jq -r ".[0].Id"
  docker image inspect "$1:$2" | jq -r ".[0].Container"
}

docker_check_image_uptodate() {
  safeexec test "$(docker_get_img_local_hash $1 $2)" == "$(docker_get_img_repo_hash $1 $2)"
  return $ex
}

docker_run_d() {
  name="$1"
  shift
  image="$1"
  shift
  tag="$1"
  shift
  if ! docker_check_image_uptodate "$image" "$tag"; then
    docker pull "$image:$tag"
    safeexec docker stop "$name"
    safeexec docker rm "$name"
    docker run -d --name "$name" "$@" "$image:$tag"
  fi
}

# other

file_contains() { # does $1 contain $2?
  safeexec grep "$2" "$1" > /dev/null
  return $ex
}

update_file() { # update src=$1 dest=$2
  if ! diff -u "$2" "$1"; then
    echo "Updating $2..."
    cp "$1" "$2"
  fi
}

repl_in_file() { # replace $1 with $2 in $3
  sed "s|$1|$2|g" -i "$3"
}

is_cjdns() {
  r=$(cjdaddr)
  test ! -z "$r"
  return $?
}

cjdaddr() {
  ifconfig | grep " fc" | grep -o "fc[0-9a-z:]*" || echo
}

curl_cached() {
  url="$1"
  shift
  cachename "$url"
  if [ -e "$cpath" ]; then
    cat "$cpath"
  else
    safeexec curl -s "$url" "$@" -o "$cpath"
    if [ $ex -ne 0 ]; then
      rm -f "$cpath"
    else
      cat "$cpath"
    fi
    return $ex
  fi
}
