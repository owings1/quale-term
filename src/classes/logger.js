/**
 * @quale/util - Logger
 *
 * Copyright (C) 2021 Doug Owings
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/* Dependencies */
import {Chalk, DefaultColorLevel} from '../colors.js'
import chalkPipe from 'chalk-pipe'
import {
    castToArray,
    isError,
    isFunction,
    isPlainObject,
    isString,
    isWriteableStream,
} from '@quale/core/types.js'
import {lget, revalue} from '@quale/core/objects.js'
import {parseStack} from '@quale/core/errors.js'
import HashProxy from '@quale/core/hash-proxy.js'
import {cat} from '@quale/core/strings.js'

import {formatWithOptions} from 'util'
import {merge, spread} from '../merging.js'
import process from 'process'


const Caret = '\u276f'
const SymHp = Symbol('hp')
const LevelNums = {
    error : 0,
    warn  : 1,
    info  : 2,
    log   : 3,
    debug : 4,
}
const LevelNames = Object.keys(LevelNums).sort((a, b) =>
    LevelNums[a] - LevelNums[b]
)

/**
 * Define defaults.
 */
const Defaults = {}

/**
 * I/O {WritableStream}.
 */
Defaults.stdout = process.stdout
Defaults.stderr = process.stderr

/**
 * Whether to write only to stdout.
 */
Defaults.oneout = false

/**
 * The default log level. If the `DEBUG` environment variable is set, then the
 * default is debug (4). Then the environment variables `LOG_LEVEL` and `LOGLEVEL`
 * are checked. Otherwise the default is info (2).
 */
if (process.env.DEBUG) {
    Defaults.logLevel = 'debug'
} else if (process.env.LOG_LEVEL) {
    Defaults.logLevel = process.env.LOG_LEVEL
} else if (process.env.LOGLEVEL) {
    Defaults.logLevel = process.env.LOGLEVEL
} else {
    Defaults.logLevel = 'info'
}
/** @type {Number} */
Defaults.logLevel = getLevelNumber(Defaults.logLevel)

/**
 * Whether to use colors. Default is to use chalk's determination.
 * {integer}
 */
Defaults.colors = DefaultColorLevel

/**
 * Options to pass to `util.formatWithOptions()`. By default, the `colors`
 * option is set to `opts.colors`.
 *
 * See: https://nodejs.org/api/util.html#util_util_inspect_object_showhidden_depth_colors
 *
 * {object}
 */
Defaults.inspect = {}

/**
 * Whether to format keywords.
 *
 * {boolean}
 */
Defaults.keywords = true

/**
 * The chalk color styles to use.
 */
Defaults.styles = {
    default : 'chalk',
    brace   : 'grey',
    keywords: {
        file: {
            default : 'cyan',
            error   : 'yellow',
            warn    : 'yellow',
        },
    },
    error: {
        prefix  : 'red',
        string  : '#884444',
        error : {
            name    : 'bgRed.black',
            message : 'red',
            stack   : 'grey',
        },
    },
    warn: {
        prefix : 'yellow',
        string : 'chalk',
        error  : {
            name    : 'yellow.bold.italic',
            message : 'chalk',
            stack   : 'grey',
        },
    },
    info: {
        prefix : 'grey',
        string : 'chalk',
        error : {
            name    : 'yellow.bold.italic',
            message : 'chalk',
            stack   : 'grey',
        },
    },
    log: {
        prefix : 'grey',
        string : 'chalk',
        error : {
            name    : 'yellow.bold.italic',
            message : 'chalk',
            stack   : 'grey',
        },
    },
    debug: {
        prefix : 'blue',
        string : 'chalk',
        error : {
            name    : 'yellow.bold.italic',
            message : 'chalk',
            stack   : 'grey',
        },
    },
}

/**
 * Log prefix function.
 *
 * @param {String} level The log level, error, warn, info, log, or debug.
 * @return {String|String[]} The formatted prefix message(s)
 */
Defaults.prefix = function (level) {
    const {chalks} = this
    if (level === 'info') {
        return chalks[level].prefix(Caret)
    }
    return cat(
        chalks.brace('['),
        chalks[level].prefix(level.toUpperCase()),
        chalks.brace(']'),
    )
}

/**
 * Format arguments to a string. This is called for prefixing, logging,
 * and the general format() method.
 *
 * @param {String} level The level. Calls to logger.format() will be 'info'. Calls to
 *        logger.eformat() will be 'error'.
 * @param {Array} args The arguments of any type.
 * @return {String} The formatted message string.
 */
Defaults.format = function (level, args) {
    args = preformat.call(this, level, args)
    const {colors} = this.opts
    const opts = spread({colors}, this.opts.inspect)
    return formatWithOptions(opts, ...args)
}

export default class Logger {

    /**
     * @param {object} opts The options
     */
    constructor(opts) {
        opts = merge(Defaults, opts)
        checkWriteStream(opts.stdout, 'opts.stdout')
        checkWriteStream(opts.stderr, 'opts.stderr')
        const chalk = new Chalk({
            level: getOptColorLevel(opts.colors),
        })
        //this._styles = opts.styles
        const chalkp = HashProxy.create(opts.styles, {
            filter     : isString,
            transform  : style => chalkPipe(style, chalk),
            enumerable : true,
        })
        Object.defineProperty(this, SymHp, {value: chalkp})
        Object.defineProperties(opts, {
            colors: {
                enumerable: true,
                get: () => Boolean(this.chalk.level),
                set: v => this.chalk.level = getOptColorLevel(v),
            },
            styles: {get: () => chalkp.ingress, enumerable: true},
        })
        Object.defineProperties(this, {
            chalk  : {value: chalk},
            chalks : {value: chalkp.target},
            opts   : {value: opts},
            ...revalue(LevelNums, level => (
                {value: log.bind(this, level), enumerable: true}
            )),
        })
    }

    addStyle(k, v) {
        this[SymHp].upsertEntry(k, v)
    }

    format(...args) {
        return this.lformat('info', ...args)
    }

    eformat(...args) {
        return this.lformat('error', ...args)
    }

    lformat(level, ...args) {
        return this.opts.format.call(this, getLevelName(level), args)
    }

    print(...args) {
        this.lprint('info', ...args)
    }

    eprint(...args) {
        this.lprint('error', ...args)
    }

    lprint(level, ...args) {
        this.lwrite(level, this.lformat(level, ...args) + '\n')
    }

    write(data) {
        this.lwrite('info', data)
    }

    ewrite(data) {
        this.lwrite('error', data)
    }

    lwrite(level, data) {
        const strm = getLevelNumber(level) < 2 ? this.stderr : this.stdout
        strm.write(data)
    }
    
    get name() {
        return this.opts.name || 'Logger'
    }

    set name(name) {
        this.opts.name = name
    }

    get stdout() {
        return this.opts.stdout
    }

    set stdout(stdout) {
        checkWriteStream(stdout, 'stdout')
        this.opts.stdout = stdout
    }

    get stderr() {
        if (this.opts.oneout) {
            return this.opts.stdout
        }
        return this.opts.stderr
    }

    set stderr(stderr) {
        checkWriteStream(stderr, 'stderr')
        this.opts.stderr = stderr
    }

    get logLevel() {
        return getLevelNumber(this.opts.logLevel)
    }

    set logLevel(n) {
        this.opts.logLevel = n
    }
}

/**
 * The main logging function, bound to individual methods in the constructor.
 *
 * @param {String} level The level, 'info', 'warn', etc.
 * @param {...*} args The arguments
 */
function log (level, ...args) {
    level = getLevelNumber(level)
    if (level > this.logLevel) {
        return
    }
    const method = level < 2 ? 'ewrite' : 'write'
    const levelName = LevelNames[level]
    const {opts} = this
    const prefix = getPrefix.call(this, levelName)
    const body = this.opts.format.call(this, levelName, args)
    if (prefix) {
        this[method](prefix + (body ? ' ' : ''))
    }
    this[method](body + '\n')
}

/**
 * Construct the prefix.
 * @private
 *
 * @param {String} level The level, 'info', 'warn', etc.
 * @return {String}
 */
function getPrefix (level) {
    const {opts} = this
    let prefix
    if (isFunction(opts.prefix)) {
        prefix = opts.prefix.call(this, level)
    } else if (isString(opts.prefix)) {
        prefix = opts.prefix
    } else if (opts.prefix === true) {
        prefix = Defaults.prefix.call(this, level)
    }
    return castToArray(prefix).join(' ')
}

/**
 * Pre-process/filter arguments before they are formatted.
 * @private
 *
 * @param {String} level The log level, error, warn, info, log, or debug.
 * @param {Array} args The arguments of any type.
 * @return {Array} The processed/filtered arguments of any type.
 */
function preformat (level, args) {
    const {chalks} = this
    const {keywords} = this.opts
    const hasError = args.some(isError)
    const isThrowing = hasError && args.some(arg => arg && arg.throwing)
    const newArgs = []
    args.forEach(arg => {
        if (isString(arg)) {
            newArgs.push(chalks[level].string(arg))
            return
        }
        if (isError(arg)) {
            newArgs.push(formatError.call(this, level, arg, isThrowing))
            return
        }
        if (isPlainObject(arg)) {
            const entries = []
            Object.entries(arg).forEach(([key, value]) => {
                if (hasError && key === 'throwing') {
                    // Special key.
                    return
                }
                if (keywords && chalks.keywords[key]) {
                    // Handle keywords..
                    newArgs.push(formatKeyword.call(this, level, key, value))
                    return
                }
                entries.push([key, value])
            })
            if (entries.length) {
                newArgs.push(Object.fromEntries(entries))
            }
            return
        }
        newArgs.push(arg)
    })
    return newArgs
}

/**
 * Format a keyword.
 * @private
 *
 * @param {String} level
 * @param {String} key
 * @param {*} value
 * @return {String}
 */
function formatKeyword (level, key, value) {
    const {chalks} = this
    const valueChalk = chalks.keywords[key] && lget(
        chalks.keywords[key], level, lget(chalks.keywords[key], 'default')
    )
    return [
        chalks[level].string(key),
        valueChalk ? valueChalk(value) : value,
    ].join(' ')
}

/**
 * Format an error.
 * @private
 *
 * @param {String} level
 * @param {Error} err
 * @param {boolean} isThrowing
 * @return {String}
 */
function formatError (level, err, isThrowing = false) {
    const levelNum = getLevelNumber(level)
    level = LevelNames[levelNum]
    const chlk = this.chalks[level].error
    const {stack, rawMessage} = parseStack(err)
    const name = err.name || err.constructor.name
    const lines = []
    lines.push(
        [chlk.name(name), chlk.message(rawMessage)].join(': ')
    )
    const isPrintStack = this.logLevel > 3 || (
        levelNum < 1 && !isThrowing
    )
    if (isPrintStack) {
        lines.push(chlk.stack(stack))
    }
    return lines.join('\n')
}

/**
 * @param {String|Number} value
 * @return {Number}
 */
function getLevelNumber (value) {
    if (isString(value)) {
        value = value.toLowerCase()
    }
    if (value in LevelNums) {
        return LevelNums[value]
    }
    if (value in LevelNames) {
        return +value
    }
    if (value < 0) {
        return -1
    }
    return Defaults.logLevel
}

/**
 * @param {*} value
 * @return {String}
 */
function getLevelName (value) {
    return LevelNames[getLevelNumber(value)]
}

/**
 * @param {Boolean|String} value
 * @return {Number}
 */
function getOptColorLevel (value) {
    if (value === 'force') {
        return Defaults.colors || 1
    }
    return value ? Defaults.colors : 0
}

/**
 * @throws {TypeError}
 * @param {*} arg
 * @param {String} name
 */
function checkWriteStream (arg, name) {
    if (!isWriteableStream(arg)) {
        throw new TypeError(`Argument ${name} is not a writeable stream`)
    }
}