'use strict'

const yaml = require('js-yaml')
const utils = require('../utils')

/* eslint-disable guard-for-in */
/* eslint-disable no-template-curly-in-string */

const Modules = {
  ufw: require('./mod/ufw')
}

function compileFile(data, main, host) {
  /*

  Structure:
    affects?
      pre
      installed?
        installedVer == newVer?
          update
        else
          upgrade
      else
        install
      post

  */

  function wrapStep (what, step) {
    utils.tree()
  }

  utils.tree()
    .varArray('affects', data.affects)
    .if('contains "${affects[@]}" "$(hostname)"', utils.tree()
      // vars
      .var('SCRIPT_NAME', data.name)
      .var('SCRIPT_VERSION', data.version)
      .var('SCRIPT_ID', utils.shortHash(data.name))
      .varExec('SCRIPT_CUR_VERSION', 'getVersion')
      .varExec('SCRIPT_INSTALLED', 'getInstalledStatus')
      .varExec('STEPS_INSTALLED', 'getInstalledSteps')
      .varArray('SCRIPT_STEPS', data.steps.map(s => s.fullId))
      // uninstall old steps
      .for('step', '$STEPS_INSTALLED', utils.tree()
        .if('! contains "${SCRIPT_STEPS[@]}" "$step"', utils.tree()
          .cmd('.', '$STATE_FOLDER/$step_uninstall.sh')
          .cmd('rm', '$STATE_FOLDER/$step_uninstall.sh')
          .cmd('rm', '$STATE_FOLDER/$step_installed'))
      )
      // install/upgrade/update new ones
      .append(...data.steps.map(s => utils.tree()
        .append(step.pre || ('#' + s.fullId + ' pre'))
         // if not installed: install
        .if('! isStepInstalled ' + s.fullId, step.add || ('# ' + s.fullId + ' add'),
          // if upgrade avail: upgrade
          step.upgradeCond || 'false', step.upgrade,
          // else update
          step.update || ('#' + s.fullId + ' update'))
        .append(step.post || ('#' + s.fullId + ' post'))
      /* .append(data.modules.map(s => wrapStep('pre', s)))
      .if('$SCRIPT_INSTALLED', utils.tree()
        .if('[ "$SCRIPT_VERSION" != "$SCRIPT_CUR_VERSION" ]', () => {

        }),
      utils.tree()
        .if()
      )
      .append(data.modules.map(s => wrapStep('post', s))) */
    )
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
