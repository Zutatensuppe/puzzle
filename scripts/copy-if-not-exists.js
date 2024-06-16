const fs = require('fs')
const [from, to] = process.argv.slice(2)
if (!fs.existsSync(to)) {
  fs.copyFileSync(from, to)
}
