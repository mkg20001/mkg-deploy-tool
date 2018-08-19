'use strict'

const shellEscapeReal = require('shell-escape')
const shellEscape = require('./escapeWithVar')
const parser = require('bash-parser')
const alphanumSort = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'}).compare

const treeFnc = {
  if: (sCond, sIf, ...args) => {
    let out = ['if ' + sCond + '; then', sIf]
    while (args.length >= 2) {
      let [sCond, sElif] = args.splice(0, 2)
      out.push('elif ' + sCond + '; then', sElif)
    }
    if (args.length) {
      out.push('else', args[0])
    }
    out.push('fi')
    return out.join('\n')
  },
  varArray: (name, ar) => {
    return name + '=(' + shellEscape(ar) + ')'
  },
  varExec: (name, ...cmd) => {
    return name + '=$(' + shellEscape(cmd) + ')'
  },
  var: (name, val) => {
    return name + '=' + shellEscape([val])
  },
  for: (as, from, code) => {
    return ['for ' + as + ' in ' + from + '; do', code, 'done'].join('\n')
  },
  cmd: (...args) => {
    return shellEscape(args)
  },
  append: (...str) => str.join('\n'),
  b64: (...args) => {
    return shellEscape('echo', Buffer.from(args.join('\n')).toString('base64')) + ' | base64 -d'
  }
}

function tree () {
  let obj = {_isTreeObj: true}
  let out = []
  for (const fnc in treeFnc) { // eslint-disable-line guard-for-in
    obj[fnc] = (...args) => {
      args = args.map(a => a._isTreeObj ? a.str() : a)
      out.push(treeFnc[fnc](...args))

      return obj
    }
  }
  obj.str = () => out.join('\n')

  return obj
}

function parseCmd (line) {
  let parsed = parser(line).commands[0]
  return [parsed.name.text, ...parsed.suffix.map(s => s.text)]
}

const crypto = require('crypto')
const shortHash = (str) => {
  let hash = crypto.createHash('sha512').update(str).digest('hex')
  return hash.substr(parseInt(hash.substr(0, 1), 16), 16)
}

function wrap (type, data, prop) {
  return Object.assign({id: shortHash(data), type}, prop)
}

function sortByPrio (a, b) {
  if (typeof a.priority === 'undefined') {
    a.priority = 100
  }

  if (typeof b.priority === 'undefined') {
    b.priority = 100
  }

  if (a.priority - b.priority) {
    return a.priority - b.priority
  }

  if (a.name) {
    return alphanumSort(a.name, b.name)
  }

  if (a.fullId) {
    return alphanumSort(a.fullId, b.fullId)
  }

  return 0
}

module.exports = {
  parseCmd,
  shellEscape,
  shellEscapeReal,
  wrap,
  tree,
  shortHash,
  sortByPrio
}
