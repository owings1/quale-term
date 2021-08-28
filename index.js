const pkg = module.exports = {
    // classes
    get Logger()  { return require('./src/classes/logger.js' )},
    // utils
    get colors()  { return require('./src/colors.js'  )},
    get merging() { return require('./src/merging.js' )},
}