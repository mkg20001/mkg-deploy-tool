'use strict'

const utils = require('./utils')
const fs = require('fs')
const path = require('path')
const Template = String(fs.readFileSync(path.join(__dirname, 'template.sh')))

/* eslint-disable guard-for-in */
/* eslint-disable no-template-curly-in-string */
/* eslint-disable complexity */

const Modules = {
  backup: require('./mod/backup'),
  link: require('./mod/link'),
  pkg: require('./mod/pkg'),
  snap: require('./mod/snap'),
  systemd: require('./mod/systemd'),
  ufw: require('./mod/ufw')
}

const ModulesMain = {
  auth: require('./mod/auth').main,
  backup: require('./mod/backup').main,
  git: require('./mod/git').main
}

function removeScript (type) {
  if (!type) {
    type = 'step'
  }

  const typeUP = type.toUpperCase()

  return utils.tree()
    .varExec(typeUP + '_UNINSTALL_PATH', 'stateFnc', type, 'uninstall', 'path')
    .cmd('.', '$' + typeUP + '_UNINSTALL_PATH')
    .cmd('stateFnc', type, 'installed', 'rm')
    .cmd('stateFnc', type, 'uninstall', 'rm')
}

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

  function wrapStep (what, whatDisplay, step, vars) {
    if (step[what]) {
      return utils.tree()
        .append('# ' + step.fullId + ' ' + what).append(vars ? getStepVars(step) : '').cmd('heading', whatDisplay + ' ' + (step.displayName || step.fullId) + '...').append(step[what]).str()
    }
    return 'true # ' + step.fullId + ' ' + what
  }

  function getVars () {
    return utils.tree()
      .var('SCRIPT_NAME', data.name)
      .var('SCRIPT_VERSION', data.version)
      .var('SCRIPT_ID', data.id)
      .varExec('SCRIPT_CUR_VERSION', 'getVersion')
      .varExec('SCRIPT_INSTALLED', 'isScriptInstalledAsEcho')
      .varExec('STEPS_INSTALLED', 'getInstalledSteps')
      .varArray('SCRIPT_STEPS', data.steps.map(s => s.fullId))
  }

  function getStepVars (step) {
    return utils.tree()
      .var('STEP_ID', step.fullId)
      .var('STEP_VERSION', step.version || 'v0')
      .var('STEP_NAME', step.displayName || step.fullId)
      .varExec('STEP_CUR_VERSION', 'getStepVersion')
      .varExec('STEP_INSTALLED', 'isStepInstalledAsEcho')
      .varExec('STEP_UNINSTALL_PATH', 'stateFnc', 'step', 'uninstall', 'path')
  }

  return utils.tree()
    .varArray('affects_include', data.affects.include)
    .varArray('affects_exclude', data.affects.exclude)
    .var('affects_wildcard', data.affects.wildcard)
    .if('(contains "$(hostname)" "${affects_include[@]}" || $affects_wildcard) && ! contains "$(hostname)" "${affects_exclude[@]}"', getVars()
      .cmd('headingMain', 'Deploying ' + data.name)
      // uninstall old steps
      .for('STEP_ID', '$STEPS_INSTALLED', utils.tree()
        .if('! contains "${STEP_ID}" "${SCRIPT_STEPS[@]}" && isStepInstalled', removeScript())
      )
      // install/upgrade/update new ones
      .append(...data.steps.map(step => utils.tree()
        .append(getStepVars(step))
        .append(wrapStep('pre', 'Running pre hook for', step))
        // if not installed: install
        .if('! isStepInstalled', wrapStep('install', 'Installing', step),
          // if upgrade avail: upgrade
          step.upgradeCond || 'false', wrapStep('upgrade', 'Upgrading', step),
          // else update
          wrapStep('update', 'Updating', step))
        .append('stateFnc step installed set "$STEP_VERSION"') // mark step as installed

        .b64(wrapStep('remove', 'Removing', step, true)) // write b64 uninstaller
        .append(' > "$STEP_UNINSTALL_PATH"') // ...to uninstall path

        .append(wrapStep('post', 'Running post hook for', step))
      ))
      .append('stateFnc script installed set "$SCRIPT_VERSION"') // mark script as installed

      .varExec('SCRIPT_UNINSTALL_PATH', 'stateFnc', 'script', 'uninstall', 'path')
      .b64(getVars() // write b64 script uninstaller
        .for('STEP_ID', 'getInstalledSteps', utils.tree()
          .if('isStepInstalled', removeScript())
        ))
      .append('> "$SCRIPT_UNINSTALL_PATH"') // ...to uninstaller path

      .b64(getVars() // append b64 cron script
        .append(...data.steps.map(step => utils.tree()
          .append(getStepVars(step))
          .if('isStepInstalled', wrapStep('cron', 'Running cronjob for', step))
          .append('') // fix missing newline
        )))
      .append('>> "$CRON_FILE"') // ...to cron file
    )
    .str()
}

function compile (files, mainData) {
  let tmplBasic = [Template.replace('#DATAPREFIX-DPLTOOL#', mainData.config.dataDirectory), 'export MAINFOLDER=' + utils.shellEscapeReal([mainData.mainFolder])]
  let out = [...tmplBasic, 'mainEntry']
  let cron = [...tmplBasic, 'cronEntry']

  // uninstall old scripts
  out.push(utils.tree()
    .varArray('SCRIPTS', files.map(s => s.id))
    .varExec('SCRIPTS_INSTALLED', 'getInstalledScripts')
    .for('SCRIPT_ID', '$SCRIPTS_INSTALLED', utils.tree()
      .if('! contains "$SCRIPT_ID" "${SCRIPTS[@]}"', removeScript('script')))
    .str())

  // pre-steps
  const fakePreFile = processFile('preMainModule', {priority: 1, affects: ['*']}, mainData)
  let steps = []
  for (const module in mainData.modules) {
    if (ModulesMain[module].isPre) {
      let out = ModulesMain[module](mainData.modules[module], mainData)
      steps = steps.concat(Array.isArray(out) ? out : [out])
    }
  }
  steps = fakePreFile.steps = steps.sort(utils.sortByPrio)
  steps.map(s => {
    s.fullId = s.type + '_' + utils.shortHash('preMainModule') + '_' + s.id
  })

  files.unshift(fakePreFile)

  // post-steps
  const fakePostFile = processFile('postMainModule', {priority: 1001, affects: ['*']}, mainData)
  steps = []
  for (const module in mainData.modules) {
    if (!ModulesMain[module].isPre) {
      let out = ModulesMain[module](mainData.modules[module], mainData)
      steps = steps.concat(Array.isArray(out) ? out : [out])
    }
  }
  steps = fakePostFile.steps = steps.sort(utils.sortByPrio)
  steps.map(s => {
    s.fullId = s.type + '_' + utils.shortHash('postMainModule') + '_' + s.id
  })

  files.push(fakePostFile)

  // update/install current scripts
  files.forEach(file => {
    out.push(compileFile(file, mainData))
  })

  out.push('mainPost')
  out.push('')
  cron.push('')

  return out.join('\n').replace('-$-CRONSCRIPT-$-', Buffer.from(cron.join('\n')).toString('base64'))
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
    include = include.filter(h => h !== '*')

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
  lfPre.upgradeCond = lfPost.upgradeCond = '[ "$SCRIPT_CUR_VERSION" != "$SCRIPT_VERSION" ]' // default upgrade on version change
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

  steps = steps.sort(utils.sortByPrio)

  // embed
  let embed = data.embed || []

  // version
  let version = data.version || 'v0'

  return {affects, lifecycle, steps, embed, name, version, id: utils.shortHash(name)}
}

function processMain (data, mainFolder) {
  let groups = data.groups || {}
  let config = data.config || {dataDirectory: '/etc/mkg-deploy-tool'}
  let modules = data.modules || {}

  return {groups, config, mainFolder, modules}
}

module.exports = {
  compileFile,
  processFile,
  processMain,
  compile
}
