#!/usr/bin/env node

'use strict'

/* eslint-disable no-console */

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')

const read = (file) => yaml.safeLoad(String(fs.readFileSync(file)))

const {compile, processFile, processMain} = require('.')

const main = fs.realpathSync(process.argv[2])
const confDir = path.join(path.dirname(main), 'deploy.d')

const mainData = processMain(read(main), path.dirname(main))

const files = fs
  .readdirSync(confDir)
  .filter(f => f.endsWith('.yaml'))
  .map(file => processFile(path.basename(file).split('.')[0], read(path.join(confDir, file)), mainData))
  .sort((a, b) => a.priority - b.priority)

console.log(compile(files, mainData))
