'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { joinPathSegmentsWithinRoot } = require('../../core/io/path-boundary');

async function writeBufferAtomic(filePath, buffer) {
  const directory = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const randomSuffix = crypto.randomBytes(5).toString('hex');
  const tempPath = joinPathSegmentsWithinRoot(directory, [`${baseName}.${randomSuffix}.tmp`], {
    resolveSymlinks: false,
  });

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, filePath);
}

module.exports = {
  writeBufferAtomic,
};
