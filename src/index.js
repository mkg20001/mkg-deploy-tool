'use strict'

const utils = require('./utils')

/* eslint-disable guard-for-in */
/* eslint-disable no-template-curly-in-string */
/* eslint-disable complexity */

const Modules = {
  link: require('./mod/link'),
  pkg: require('./mod/pkg'),
  ufw: require('./mod/ufw')
}

const stepPrefx = '$STATE_FOLDER/step_${SCRIPT_ID}_${STEP_ID}'
const scriptPrefx = '$STATE_FOLDER/script_${SCRIPT_ID}'

function compileFile (data, main) {
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
      return utils.tree().append('# ' + step.fullId + ' ' + what).cmd('heading', whatDisplay + ' ' + (step.displayName || step.fullId) + '...').append(step[what]).str()
    }
    return 'true # ' + step.fullId + ' ' + what
  }

  function getVars () {
    return utils.tree()
      .var('SCRIPT_NAME', data.name)
      .var('SCRIPT_VERSION', data.version)
      .var('SCRIPT_ID', utils.shortHash(data.name))
    // .varExec('SCRIPT_CUR_VERSION', 'getVersion')
      .varExec('SCRIPT_INSTALLED', 'getInstalledStatusEcho')
      .varExec('STEPS_INSTALLED', 'getInstalledSteps')
      .varArray('SCRIPT_STEPS', data.steps.map(s => s.fullId))
  }

  function removeScript () {
    return utils.tree()
      .cmd('.', stepPrefx + '_uninstall.sh')
      .cmd('rm', stepPrefx + '_uninstall.sh')
      .cmd('rm', stepPrefx + '_installed')
  }

  return utils.tree()
    .varArray('affects_include', data.affects.include)
    .varArray('affects_exclude', data.affects.exclude)
    .var('affects_wildcard', data.affects.wildcard)
    .if('(contains "$(hostname)" "${affects_include[@]}" || $affects_wildcard) && ! contains "$(hostname)" "${affects_exclude[@]}"', getVars()
      .cmd('headingMain', 'Deploying ' + data.name)
      // uninstall old steps
      .for('STEP_ID', '$STEPS_INSTALLED', utils.tree()
        .if('! contains "${STEP_ID}" "${SCRIPT_STEPS[@]}" && isStepInstalled ${STEP_ID}', removeScript())
      )
      // install/upgrade/update new ones
      .append(...data.steps.map(step => utils.tree()
        .var('STEP_ID', step.fullId)
        .append(wrapStep('pre', 'Running pre hook for', step))
        // if not installed: install
        .if('! isStepInstalled', wrapStep('install', 'Installing', step),
          // if upgrade avail: upgrade
          step.upgradeCond || 'false', wrapStep('upgrade', 'Upgrading', step),
          // else update
          wrapStep('update', 'Updating', step))
        .append(`echo 1 > "${stepPrefx}_installed"`)
        .append('echo ' + Buffer.from(wrapStep('remove', 'Removing', step)).toString('base64') + ' |' +
          `base64 -d > "${stepPrefx}_uninstall.sh"`)
        .append(wrapStep('post', 'Running post hook for', step))
      ))
      .append(`echo "true" > "${scriptPrefx}_installed"`)
      .append('echo ' + Buffer.from(getVars() // write uninstall script
        .for('STEP_ID', '${SCRIPT_STEPS[@]}', utils.tree()
          .if('isStepInstalled', removeScript())
        ).str()).toString('base64') + '|' +
      `base64 -d  > "${scriptPrefx}_uninstall.sh"`)
      .append('echo ' + Buffer.from(getVars() // append to cron script
        .append(...data.steps.map(step => utils.tree()
          .var('STEP_ID', step.fullId)
          .if('isStepInstalled', wrapStep('cron', 'Running cronjob for', step))
          .append('') // fix missing newline
        ))
        .str()
      ).toString('base64') + '|' +
      'base64 -d >> "$CRON_FILE"')
    )
    .str()
}

function calcAffects (groups_, calcGrp) {
  let groups = {}
  for (const group in groups_) { // copy
    groups[group] = groups_[group].slice(0)
  }
  groups._ = calcGrp

  for (const group in groups) {
    groups[group].forEach((e, i) => { // eslint-disable-line
      if (e.startsWith('$')) { // nested group
        if (!groups[e.substr(1)]) {
          throw new Error('Group ' + group + ' references subgroup ' + e.substr(1) + ' that does not exist')
        }
        groups[group][i] = {type: 'group', val: groups[e.substr(1)]}
      } else if (e.startsWith('!$')) { // nested group to exclude
        if (!groups[e.substr(2)]) {
          throw new Error('Group ' + group + ' references subgroup ' + e.substr(2) + ' that does not exist')
        }
        groups[group][i] = {type: 'group', not: true, val: groups[e.substr(2)]}
      } else if (e.startsWith('!')) { // host to exclude
        groups[group][i] = {type: 'host', not: true, val: e.substr(1)}
      } else {
        groups[group][i] = {type: 'host', val: e}
      }
    })
  }

  let groupsOut = {}

  for (const group in groups) {
    let include = []
    let exclude = []

    function pr (ar, not) { // eslint-disable-line
      ar.forEach(e => { // TODO: ^^
        let ar = (e.not || not) ? exclude : include
        switch (e.type) {
          case 'group':
            pr(e.val, e.not)
            break
          case 'host':
            ar.push(e.val)
            break
          default: throw new TypeError(e.type)
        }
      })
    }

    pr(groups[group])

    exclude.forEach(host => {
      if (include.indexOf(host) !== -1) {
        throw new Error('Group ' + group + ' both excludes and includes host ' + host)
      }
    })

    let wildcard = include.indexOf('*') !== -1
    include = include.map(h => h !== '*')

    groupsOut[group] = {wildcard, include, exclude}
  }

  return groupsOut._
}

function processFile (name, data, main) {
  let affects = data.affects || []
  affects = calcAffects(main.groups, affects)

  // modules
  let modules = data.modules || {}
  let steps = []
  for (const module in modules) {
    let out = Modules[module](modules[module], {data, name}, main)
    steps = steps.concat(Array.isArray(out) ? out : [out])
  }

  // lifecycle
  let lifecycle = data.lifecycle || {}
  let lfPre = utils.wrap('lf', 'pre', {displayName: 'lifecycle ' + name, priority: 0})
  let lfPost = utils.wrap('lf', 'post', {displayName: 'lifecycle ' + name, priority: 1000})
  for (const lf in lifecycle) {
    let [name, part] = lf.split('.')
    let data = Array.isArray(lifecycle[lf]) ? lifecycle[lf].join('\n') : lifecycle[lf]
    if (part === 'pre') {
      lfPre[name] = data
    } else if (part === 'post') {
      lfPost[name] = data
    }
  }

  steps.push(lfPre, lfPost)

  steps.map(s => {
    s.fullId = s.type + '_' + utils.shortHash(name) + '_' + s.id
  })

  steps = steps.sort((a, b) => a.priority - b.priority)

  // embed
  let embed = data.embed || []

  // version
  let version = data.version || 'v0'

  return {affects, lifecycle, steps, embed, name, version}
}

function processMain (data, mainFolder) {
  let groups = data.groups || {}

  return {groups, mainFolder}
}

module.exports = {
  compileFile,
  processFile,
  processMain
}
