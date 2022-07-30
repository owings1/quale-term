import deepmerge from 'deepmerge'
import {objects} from '@quale/core'
const {isObject, isPlainObject} = objects

export function mergePlain(...args: any[]) {
    return deepmerge.all(args.filter(isPlainObject), {
        isMergeableObject: isPlainObject,
    })
}

export function spreadMerge(...args: any[]) {
    return Object.fromEntries(
        args.filter(isObject).map(Object.entries).flat()
    )
}

export {mergePlain as merge, spreadMerge as spread}
