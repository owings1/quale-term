
function getError(cb) {
    let ret
    try {
        ret = cb()
    } catch (err) {
        return err
    }
    if (ret instanceof Promise) {
        return new Promise((resolve, reject) => {
            ret.then(res => {
                console.log(res)
                reject(new GetErrorError('No error returned'))
            }).catch(resolve)
        })
    } else {
        console.log(ret)
        throw new GetErrorError('No error returned')
    }
}

class TestError extends Error {
    constructor(...args) {
        super(...args)
        this.name = this.constructor.name
    }
}

class GetErrorError extends TestError {}

module.exports = {ger: getError, TestError}