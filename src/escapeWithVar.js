'use strict'

const shellEscape = require('shell-escape')
const dblQuote = '"'

module.exports = (args) => {
  return args.map(arg => {
    let escaped = shellEscape([arg])
    let quote = escaped[0]
    return escaped.replace(/\$(\{[^}]+\}|[a-z0-9A-Z_]+)/, (r) => quote + dblQuote + r + dblQuote + quote)
  }).join(' ')
}
