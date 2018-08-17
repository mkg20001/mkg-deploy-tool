'use strict'

const utils = require('../utils')

module.exports = (config) => { // config is an array of entries about which rules to add/rm
  return Object.keys(config).map((from, i) => {
    let to = config[from]
    return utils.wrap('link', from, {
      install: utils.tree()
        .if(`[ -e "${to}" ]`, utils.tree().cmd('mv', '-v', `${to}`, `${to}.bak`))
        .cmd('ln', '-sf', `$MAIN_FOLDER/${from}`, to)
        .str(),
      remove: utils.tree()
        .cmd('rm', '-fv', to)
        .if(`[ -e "${to}.bak" ]`, utils.tree().cmd('mv', '-v', `${to}.bak`, `${to}`))
        .str(),
      displayName: 'link from ' + [from, to].map(JSON.stringify).join(' to ')
    })
  })
}
