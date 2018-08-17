'use strict'

const utils = require('../utils')

module.exports = (config) => { // config is an array of entries about which rules to add/rm
  return config.map(utils.parseCmd).map((cmds, i) =>
    utils.wrap('ufw', config[i], {
      add: utils.shellEscape(['ufw', ...cmds]),
      remove: utils.shellEscape(['ufw', 'delete', ...cmds])
    })
  )
}
