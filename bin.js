#!/usr/bin/env node

'use strict'

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const read = (file) => yaml.safeLoad(String(fs.readFileSync(file)))

const {compileFile, processFile, processMain} = require('.')

const main = process.argv[2]
const confDir = path.join(path.dirname(main), 'deploy.d')

const mainData = processMain(read(main))
let out = [String(fs.readFileSync(path.join(__dirname, 'src', 'template.sh')))]

fs.readdirSync(confDir).filter(f => f.endsWith('.yaml')).forEach(file => {
  out.push(compileFile(processFile(path.basename(file).split('.')[0], read(path.join(confDir, file)), mainData), mainData))
})

console.log(out.join('\n'))
