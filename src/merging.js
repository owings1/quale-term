const deepmerge = require('deepmerge')
const {types: {isPlainObject, isObject}} = require('@quale/core')

const merging = {
    plain: function mergePlain(...args) {
        return deepmerge.all(args.filter(isPlainObject), {
            isMergeableObject: isPlainObject,
        })
    },
    spread: function spreadMerge(...args) {
        return Object.fromEntries(
            args.filter(isObject).map(Object.entries).flat()
        )
    },
    get merge() {
        return merging.plain
    },
}

module.exports = {
    ...merging,
    ...namedf(merging),
}

function namedf(obj) {
    return Object.fromEntries(
        Object.values(obj).map(f => [f.name, f])
    )
}