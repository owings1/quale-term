import deepmerge from 'deepmerge'
import {isObject, isPlainObject} from '@quale/core/types.js'

export function mergePlain(...args) {
    return deepmerge.all(args.filter(isPlainObject), {
        isMergeableObject: isPlainObject,
    })
}

export function spreadMerge(...args) {
    return Object.fromEntries(
        args.filter(isObject).map(Object.entries).flat()
    )
}

export {mergePlain as merge, spreadMerge as spread}
