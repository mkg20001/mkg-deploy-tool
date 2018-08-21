'use strict'

const utils = require('../utils')

module.exports = (config) => { // config is an array of entries about which rules to add/rm
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
      displayName: 'systemd service ' + service
      // TODO: daemon-reload and restart service if service file hash changed
    })
  })
}
