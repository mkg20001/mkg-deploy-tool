'use strict'

const utils = require('../utils')

module.exports = (config, file, main) => {
  let out = utils.tree()
  if (config.files) {
    config.files.forEach(file => out.append(utils.tree().var('CURRENT_GLOB', file).append('backup_append_files ' + file)))
  }
  if (config.folders) {
    config.folders.forEach(folder => out.append(utils.tree().var('CURRENT_GLOB', folder).append('backup_append_files ' + folder)))
  }
  if (config.cmds) {
    config.cmds.forEach(cmd => out.append(utils.tree().cmd('echo', 'Executing cmd + ' + cmd).append(cmd)))
  }
  if (config.cmdOut) {
    config.cmdOut.forEach(item => out.append(utils.tree().var('BAK_RM_FILE', String(config.rmCmdOut || false)).var('CURRENT_GLOB', item).append('backup_append_cmdout ' + item).var('BAK_RM_FILE', 'false')))
  }

  return utils.wrap('backup', 'backup', {
    priority: 200,
    cron: out.str()
  })
}

const PRUNE_OPT_TRANSLATE = {
  within: 'keep-within',
  last: 'keep-last',
  secondly: 'keep-secondly',
  minutely: 'keep-minutely',
  hourly: 'keep-hourly',
  daily: 'keep-daily',
  weekly: 'keep-weekly',
  monthly: 'keep-monthly',
  yearly: 'keep-yearly',
  prefix: 'prefix',
  glob: 'glob-archives'
}

module.exports.main = (config, main) => {
  switch (config.type) {
    case 'borg': {
      let out = utils.tree()
      let borgCmd = []
      if (config.storage.sshpass) {
        borgCmd.push('sshpass', '-p', config.storage.url)
      }

      borgCmd.push('borg')

      if (config.storage.repo) {
        out.var('BORG_REPO', config.storage.repo)
      }
      if (config.storage.passphrase) {
        out.var('BORG_PASSPHRASE', config.storage.passphrase)
      }
      if (config.storage.passcommand) {
        out.var('BORG_PASSPHRASE', config.storage.passcommand)
      }
      out.var('BORG_RSH', 'ssh -o StrictHostKeyChecking=no')

      let createCmd = borgCmd.slice(0)
      createCmd.push('create', '--list', '--stats')
      if (config.create.exclude) {
        config.create.exclude.forEach(e => createCmd.push('--exclude', e))
      }
      if (config.create.excludedCaches) {
        createCmd.push('--exclude-caches')
      }
      if (config.extraArgs && config.extraArgs.create) {
        createCmd.push(...config.extraArgs.create)
      }
      createCmd.push('::' + config.create.name, '${LIST[@]}') // eslint-disable-line no-template-curly-in-string
      createCmd.unshift('safeexec')

      out // run create, if warning try again, otherwise continue. exit with error if final exit code non-zero
        .var('RUN_CREATE', 'true')
        .while('$RUN_CREATE', utils.tree()
          .cmd(...createCmd)
          .if('[ $ex -ne 1 ]', 'RUN_CREATE=false'))
        .if('[ $ex -ne 0 ]', utils.tree().cmd('echo', 'Borg backup failed with $ex').cmd('exit', '$ex'))

      out.cmd('rm', '-rf', '${RM_LIST[@]}') // eslint-disable-line no-template-curly-in-string

      let pruneCmd = borgCmd.slice(0)
      pruneCmd.push('prune', '--list', '--stats')
      for (const opt in config.prune) { // eslint-disable-line guard-for-in
        pruneCmd.push('--' + PRUNE_OPT_TRANSLATE[opt], config.prune[opt])
      }
      if (config.extraArgs && config.extraArgs.prune) {
        pruneCmd.push(...config.extraArgs.prune)
      }

      out.cmd(...pruneCmd)
      break
    }
    default: {
      throw new Error('Currently only borg is supported')
    }
  }
}
