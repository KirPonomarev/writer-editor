'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const media = require('./documentMedia.js');
const fail = () => { throw Error('LOCAL_IMAGE_FILE_UNSAFE'); };
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size
  && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
async function readLocalImageFile(selectedPath) {
  if (typeof selectedPath !== 'string' || !path.isAbsolute(selectedPath) || selectedPath.includes('\0')) fail();
  const literal = path.resolve(selectedPath);
  if (await fs.realpath(literal) !== literal) fail();
  const handle = await fs.open(literal, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size < 1 || before.size > media.MEDIA_LIMITS.bytes) fail();
    const bytes = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const chunk = await handle.read(bytes, length, bytes.length - length, length);
      if (!chunk.bytesRead) break;
      length += chunk.bytesRead;
    }
    const after = await handle.stat(), named = await fs.lstat(literal);
    if (length !== before.size || !same(before, after) || !same(after, named)
      || named.isSymbolicLink() || after.nlink !== 1 || await fs.realpath(literal) !== literal) fail();
    return media.createImageAttrs(bytes.subarray(0, length), { displayName: path.basename(literal) });
  } finally { await handle.close(); }
}
module.exports = { readLocalImageFile };
