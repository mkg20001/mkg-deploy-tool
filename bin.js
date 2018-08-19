#!/usr/bin/env node

'use strict'

/* eslint-disable no-console */

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const shellEscape = require('shell-escape')

const read = (file) => yaml.safeLoad(String(fs.readFileSync(file)))

const {compileFile, processFile, processMain} = require('.')

const main = fs.realpathSync(process.argv[2])
const confDir = path.join(path.dirname(main), 'deploy.d')

const mainData = processMain(read(main), path.dirname(main))
let tmplBasic = [String(fs.readFileSync(path.join(__dirname, 'src', 'template.sh'))), 'export MAINFOLDER=' + shellEscape([path.dirname(main)])]
let out = [...tmplBasic, 'mainEntry']
let cron = [...tmplBasic, 'cronEntry']

fs
  .readdirSync(confDir)
  .filter(f => f.endsWith('.yaml'))
  .map(file => processFile(path.basename(file).split('.')[0], read(path.join(confDir, file)), mainData))
  .sort((a, b) => a.priority - b.priority)
  .map(data => compileFile(data, mainData))
  .forEach(file => out.push(file))

out.push('postRun')
out.push('')
cron.push('')

console.log(out.join('\n').replace('-$-CRONSCRIPT-$-', Buffer.from(cron.join('\n')).toString('base64')))
