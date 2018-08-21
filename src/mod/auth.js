'use strict'

const utils = require('../utils')

module.exports.main = (config, main) => {
  return Object.keys(config).map(user => {
    let userConfig = config[user]
    let main = utils.tree()
      .var('user', user)
      .append('yes "$(echo -e \n)" | adduser --disabled-password "$user" || true')
      .varArray('usergroups', userConfig.groups)
      .for('group', '${usergroups[@]}', 'addgroup "$user" "$group" || true') // eslint-disable-line no-template-curly-in-string
      .append(...userConfig.keys.map(key => {
        let [type, name] = key.split(':')
        return 'HOME="/home/$user" su "$user" -c "ssh-import-id-' + type + ' ' + name + ' "'
      }))
      .str()
    return utils.wrap('auth', user, {
      priority: 10,
      install: main,
      remove: utils.tree()
        .cmd('deluser', user)
        .str(),
      upgrade: main,
      version: utils.shortHash(JSON.stringify(userConfig)) // upgrade when config changes
    })
  })
}
