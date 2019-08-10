'use strict'

const utils = require('../utils')

module.exports.main = ({logfile}, main) => {
  // config: [{logfile: '/'}]
  main = utils.tree()
    .var('LOGFILE', logfile)
    .append(`: >> "$LOGFILE"

if command -v perl >/dev/null; then
  exec \
    1> >(tee >(perl '-MPOSIX' -ne '$|++; print strftime("%m.%d.%Y %H:%M:%S %z: ", localtime()), "stdout: ", $_;' >> "$LOGFILE")) \
    2> >(tee >(perl '-MPOSIX' -ne '$|++; print strftime("%m.%d.%Y %H:%M:%S %z: ", localtime()), "stderr: ", $_;' >> "$LOGFILE") >&2)
else
  exec \
    1> >(tee >(awk '{ system(""); print strftime("%m.%d.%Y %H:%M:%S %z:"), "stdout:", $0; system(""); }' >> "$LOGFILE")) \
    2> >(tee >(awk '{ system(""); print strftime("%m.%d.%Y %H:%M:%S %z:"), "stderr:", $0; system(""); }' >> "$LOGFILE") >&2)
fi`)
    .str()

  return utils.wrap('log', logfile, {
    priority: 1,
    pre: main,
    version: '1'
  })
}

module.exports.main.isPre = true
