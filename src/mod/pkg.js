'use strict'

const utils = require('../utils')

module.exports = (config) => { // config is an array of entries about which rules to add/rm
  return config.map((pkg) =>
    utils.wrap('pkg', pkg, {
      install: utils.shellEscape(['apt-get', 'install', '-y', pkg]),
      remove: utils.shellEscape(['apt-get', 'remove', '-y', pkg]),
      displayName: 'apt package ' + pkg,
      priority: 15
    })
  )
}
