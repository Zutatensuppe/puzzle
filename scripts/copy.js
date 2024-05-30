const fs = require('fs')
const [from, to] = process.argv.slice(2)
fs.copyFileSync(from, to)
