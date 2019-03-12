'use strict'

const utils = require('../utils')

const installGit = require('./pkg')(['git'])[0]
installGit.priority = 1

module.exports.main = (config, main) => {
  // config: [{origin: '...', dest: '/'}]
  let out = config.map(({origin, dest}) => {
    let main = utils.tree()
      .var('GIT_ORIGIN', origin)
      .var('GIT_DEST', dest)
      .if('[ -e "$GIT_ORIGIN" ]', () => utils.tree()
        .append(`
pushd "$GIT_DEST"
git remote set-url origin "$GIT_ORIGIN"
git submodule init .
git fetch -p
git reset --hard HEAD
git clean -dxf
git pull --recurse-submodules
git submodule update
git gc --aggressive
popd
`),
      () => utils.tree()
        .cmd('git', 'clone', '--recursive', origin, dest))
      .str()

    return utils.wrap('git', dest, {
      priority: 2,
      post: main,
      remove: utils.tree()
        .cmd('rm', '-rf', dest)
        .str(),
      version: '1'
    })
  })

  out.unshift(installGit) // install git if not already installed

  return out
}
