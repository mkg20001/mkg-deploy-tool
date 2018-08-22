'use strict'

const utils = require('../utils')

module.exports = (config) => {
  return config.map((snap) =>
    utils.wrap('snap', snap, {
      install: utils.shellEscape(['snap', 'install', snap]),
      remove: utils.shellEscape(['snap', 'remove', snap]),
      displayName: 'snap package ' + snap,
      priority: 15
    })
  )
}
