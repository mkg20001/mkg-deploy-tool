#!/usr/bin/env node

'use strict'

/* eslint-disable no-console */

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const utils = require('./src/utils')
const glob = require('glob')

const read = (file) => yaml.safeLoad(String(fs.readFileSync(file)))

const {compile, processFile, processMain} = require('.')

const main = fs.realpathSync(process.argv[2])
const confDir = path.join(path.dirname(main), 'deploy.d')

const mainData = processMain(read(main), path.dirname(main))
if (process.env.OVERRIDE_LOCATION) {
  mainData.mainFolder = process.env.OVERRIDE_LOCATION
}

const files = glob.sync(confDir + '/**/*.yaml')
  .map(file => processFile(path.basename(file).split('.')[0], read(file), mainData))
  .sort(utils.sortByPrio)

const out = compile(files, mainData)
const cp = require('child_process')
const COMP_ALGOS = ['gzip', 'bzip2', 'lzma', 'lzop']

if (process.argv[3] === 'oneline') {
  let shortest = COMP_ALGOS
    .map((algo) => {
      let cmpThread = cp.spawnSync(algo, {input: out, stdio: 'pipe'})
      if (cmpThread.error || cmpThread.signal || cmpThread.status) {
        return null
      }
      let b64 = cmpThread.stdout.toString('base64')
      return {
        algo,
        cmd: `echo "${b64}" | base64 -d | ${algo} -dc | sudo bash -`
      }
    })
    .concat([{algo: 'plain', cmd: `echo "${Buffer.from(out).toString('base64')}" | base64 -d | sudo bash -E -`}])
    .sort((a, b) => a.length - b.length)[0]
  console.error('Compressed with %s', shortest.algo)
  console.log(shortest.cmd)
} else {
  console.log(out)
}
