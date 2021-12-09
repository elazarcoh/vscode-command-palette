import * as fs from 'fs/promises';
import { constants as fs_constants } from 'fs'

export const removeUndefined =
    <T extends Record<string, any>>(obj: T): T =>
        Object.keys(obj).reduce((acc, key) => obj[key] === undefined ? acc : { ...acc, [key]: obj[key] }, {} as T);

export const mtime = (p: string) => fs.stat(p).then(s => s.mtimeMs);

export function fileExists(file: string) {
    return fs.access(file, fs_constants.F_OK)
        .then(() => true)
        .catch(() => false);
}

export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;