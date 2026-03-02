const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

function hasDirectoryContent(directoryPath) {
  try {
    const stat = fsSync.statSync(directoryPath);
    if (!stat.isDirectory()) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const dir = fsSync.opendirSync(directoryPath);
    const firstEntry = dir.readSync();
    dir.closeSync();
    return Boolean(firstEntry);
  } catch {
    return false;
  }
}

function directoryContainsAllEntries(source, destination) {
  try {
    const sourceStat = fsSync.statSync(source);
    if (!sourceStat.isDirectory()) {
      return true;
    }
  } catch {
    return true;
  }

  let entries = [];
  try {
    entries = fsSync.readdirSync(source, { withFileTypes: true });
  } catch {
    return true;
  }

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    let destinationStat = null;
    try {
      destinationStat = fsSync.statSync(destinationPath);
    } catch {
      return false;
    }

    if (entry.isDirectory()) {
      if (!destinationStat.isDirectory()) {
        return false;
      }
      if (!directoryContainsAllEntries(sourcePath, destinationPath)) {
        return false;
      }
      continue;
    }

    if (!destinationStat.isFile()) {
      return false;
    }
  }

  return true;
}

async function copyDirectoryContents(source, destination, options = {}) {
  const overwriteExisting = options.overwriteExisting === true;
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, destinationPath, options);
      continue;
    }

    if (!overwriteExisting && fsSync.existsSync(destinationPath)) {
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
}

module.exports = {
  hasDirectoryContent,
  copyDirectoryContents,
  directoryContainsAllEntries
};
