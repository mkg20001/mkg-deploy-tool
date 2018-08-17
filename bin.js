#!/usr/bin/env node

'use strict'

const yaml = require('js-yaml')
const entry = process.argv[2]
const fs = require('fs')
const path = require('path')
const read = (file) => String(fs.readFileSync(entry))
const contents = yaml.safeLoad(read(process.argv[2]))

const {compileFile, processFile} = require('.')

console.log(compileFile(processFile(path.basename(process.argv[2]).split('.')[0], contents, {groups: {}})))
