const fs = require('fs')
const [dir] = process.argv.slice(2)
fs.mkdirSync(dir, { recursive: true })
