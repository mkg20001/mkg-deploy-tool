'use strict'

const utils = require('../utils')
const fs = require('fs')
const path = require('path')

module.exports = (config, main) => { // config is an array of entries about which rules to add/rm
  return Object.keys(config).map(service => {
    const serviceFile = config[service]

    return utils.wrap('systemd', service, {
      priority: 20,
      install: utils.tree()
        .cmd('ln', '-sf', '$MAINFOLDER/' + serviceFile, '/etc/systemd/system/' + service + '.service')
        .cmd('systemctl', 'daemon-reload')
        .cmd('systemctl', 'enable', service)
        .cmd('systemctl', 'start', service)
        .str(),
      remove: utils.tree()
        .cmd('systemctl', 'stop', service)
        .cmd('systemctl', 'disable', service)
        .cmd('rm', '-f', '/etc/systemd/system/' + service + '.service')
        .cmd('systemctl', 'daemon-reload'),
      displayName: 'systemd service ' + service,
      version: utils.shortHash(fs.readFileSync(path.join(main.mainFolder, serviceFile))),
      upgrade: utils.tree()
        .cmd('systemctl', 'daemon-reload')
        .cmd('systemctl', 'restart', service)
    })
  })
}
