import path from 'path'

process.env.APP_CONFIG = '../config.example.json'

export default {
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, '../common/src'),
    },
  },
}
