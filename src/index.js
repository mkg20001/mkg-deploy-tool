'use strict'

const yaml = require('js-yaml')
const utils = require('../utils')

/* eslint-disable guard-for-in */
/* eslint-disable no-template-curly-in-string */

const Modules = {
  ufw: require('./mod/ufw')
}

function compileFile (data, main, host) {
  /*

  Step Lifecycle:
    isOrphan?
      remove
    affects?
      pre
      installed?
        upgradeCond?
          upgrade
        else
          update
      else
        install
      post

  */

  function wrapStep (what, whatDisplay, step) {
    if (step[what]) {
      return utils.tree().cmd('heading', whatDisplay + ' ' + (step.displayName || step.fullId) + '...').append(step[what])
    }
    return '# ' + step.fullId + ' ' + what
  }

  function getVars () {
    return utils.tree()
      .var('SCRIPT_NAME', data.name)
      .var('SCRIPT_VERSION', data.version)
      .var('SCRIPT_ID', utils.shortHash(data.name))
      .varExec('SCRIPT_CUR_VERSION', 'getVersion')
      .varExec('SCRIPT_INSTALLED', 'getInstalledStatus')
      .varExec('STEPS_INSTALLED', 'getInstalledSteps')
      .varArray('SCRIPT_STEPS', data.steps.map(s => s.fullId))
  }

  function removeScript () {
    return utils.tree()
      .cmd('.', '$STATE_FOLDER/${step}_uninstall.sh')
      .cmd('rm', '$STATE_FOLDER/${step}_uninstall.sh')
      .cmd('rm', '$STATE_FOLDER/${step}_installed')
  }

  utils.tree()
    .varArray('affects', data.affects)
    .if('contains "${affects[@]}" "$(hostname)"', getVars()
      // uninstall old steps
      .for('step', '$STEPS_INSTALLED', utils.tree()
        .if('! contains "${SCRIPT_STEPS[@]}" "${step}"', removeScript())
      )
      // install/upgrade/update new ones
      .append(...data.steps.map(step => utils.tree()
        .var('step', step.fullId)
        .append(wrapStep('pre', 'Running pre hook for', step))
        // if not installed: install
        .if('! isStepInstalled ' + step.fullId, wrapStep('install', 'Installing', step),
          // if upgrade avail: upgrade
          step.upgradeCond || 'false', wrapStep('upgrade', 'Upgrading', step),
          // else update
          wrapStep('update', 'Updating', step))
        .append(utils.tree()
          .cmd('echo', '1')
          .append('>')
          .cmd('$STATE_FOLDER/${step}_installed'))
        .append(utils.tree()
          .cmd('echo', Buffer.from(wrapStep('remove', 'Removing')).toString('base64'))
          .append('|')
          .cmd('base64', '-d')
          .append('>')
          .cmd('$STATE_FOLDER/${step}_uninstall.sh'))
        .append(wrapStep('post', 'Running post hook for', step))
      ))
      .append(utils.tree()
        .cmd('echo', data.version)
        .append('>')
        .cmd('$STATE_FOLDER/${step}_installed'))
      .append(utils.tree()
        .cmd('echo', Buffer.from(getVars().append(data.steps.map(step => utils.tree() // uninstall all scripts
          .var('step', step.fullId)
          .if('isStepInstalled ' + step.fullId, removeScript())
        ))).toString('base64'))
      ) // write uninstall script
    )
}

function processFile (name, data, main) {
  let affects = []

  // affects

  if (Array.isArray(data.affects.hosts)) {
    affects = affects.concat(data.affects.hosts)
  }
  if (typeof data.affects.hosts === 'string') {
    affects.push(data.affects.hosts)
  }
  if (Array.isArray(data.affects.host)) {
    affects = affects.concat(data.affects.host)
  }
  if (typeof data.affects.hosts === 'string') {
    affects.push(data.affects.host)
  }
  if (Array.isArray(data.affects.groups)) {
    data.affects.groups.forEach(group => {
      affects = affects.concat(main.groups[group])
    })
  }
  if (typeof data.affects.groups === 'string') {
    affects = affects.concat(main.groups[data.affects.groups])
  }
  if (Array.isArray(data.affects.group)) {
    data.affects.group.forEach(group => {
      affects = affects.concat(main.groups[group])
    })
  }
  if (typeof data.affects.group === 'string') {
    affects = affects.concat(main.groups[data.affects.group])
  }

  // modules
  let modules = data.modules || {}
  let steps = []
  for (const module in modules) {
    let out = Modules[module](modules[module])
    steps = steps.concat(Array.isArray(out) ? out : [out])
  }

  // lifecycle
  let lifecycle = data.lifecycle || {}
  for (const lf in lifecycle) {
    lifecycle[lf] = lifecycle[lf].join('\n')
  }

  steps.map(s => {
    s.fullId = s.type + '_' + utils.shortHash(data.name) + '_' + s.id
  })

  // embed
  let embed = data.embed || []

  // version
  let version = data.version || 'v0'

  return {affects, lifecycle, steps, embed, name, version}
}

module.exports = {
  compileFile,
  processFile
}
