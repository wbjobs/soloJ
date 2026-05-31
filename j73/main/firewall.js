const { exec } = require('child_process')
const os = require('os')

const RULE_NAME = 'Git LFS Server'

function addFirewallRule(port) {
  if (os.platform() !== 'win32') {
    return Promise.resolve(true)
  }
  return _addWindowsRule(port)
}

function removeFirewallRule() {
  if (os.platform() !== 'win32') {
    return Promise.resolve(true)
  }
  return _removeWindowsRule()
}

function _addWindowsRule(port) {
  return new Promise((resolve) => {
    const tcpCmd = `advfirewall firewall add rule name="${RULE_NAME} TCP" dir=in action=allow protocol=TCP localport=${port} enable=yes`
    const udpCmd = `advfirewall firewall add rule name="${RULE_NAME} UDP" dir=in action=allow protocol=UDP localport=${port} enable=yes`

    _execNetsh(tcpCmd)
      .then(() => _execNetsh(udpCmd))
      .then(() => resolve(true))
      .catch(() => {
        _execNetshElevated(tcpCmd)
          .then(() => _execNetshElevated(udpCmd))
          .then(() => resolve(true))
          .catch(() => resolve(false))
      })
  })
}

function _removeWindowsRule() {
  return new Promise((resolve) => {
    const cmd1 = `advfirewall firewall delete rule name="${RULE_NAME} TCP"`
    const cmd2 = `advfirewall firewall delete rule name="${RULE_NAME} UDP"`

    _execNetsh(cmd1)
      .then(() => _execNetsh(cmd2))
      .then(() => resolve(true))
      .catch(() => resolve(false))
  })
}

function _execNetsh(args) {
  return new Promise((resolve, reject) => {
    exec(`netsh ${args}`, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(err)
      if (stdout && stdout.includes('ERROR')) return reject(new Error(stdout))
      if (stderr && stderr.includes('ERROR')) return reject(new Error(stderr))
      resolve()
    })
  })
}

function _execNetshElevated(args) {
  return new Promise((resolve, reject) => {
    const fullCmd = `netsh ${args}`
    const psCmd = `Start-Process cmd -ArgumentList '/c','${fullCmd.replace(/'/g, "''")}' -Verb RunAs -Wait -WindowStyle Hidden`

    exec(`powershell.exe -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, {
      windowsHide: true,
      timeout: 60000
    }, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

function checkFirewallRule() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      return resolve(true)
    }
    exec('netsh advfirewall firewall show rule name="Git LFS Server TCP"', { windowsHide: true }, (err, stdout) => {
      if (err) resolve(false)
      else resolve(stdout && stdout.includes('Git LFS Server'))
    })
  })
}

module.exports = { addFirewallRule, removeFirewallRule, checkFirewallRule }
