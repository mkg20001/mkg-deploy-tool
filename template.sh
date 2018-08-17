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
