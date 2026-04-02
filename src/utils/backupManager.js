const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { joinPathSegmentsWithinRoot, resolveValidatedPath } = require('../core/io/path-boundary');
const fileManager = require('./fileManager');

function getBackupsRoot(basePath) {
  if (basePath) {
    return joinPathSegmentsWithinRoot(resolveValidatedPath(basePath, { mode: 'any' }), ['backups'], { resolveSymlinks: false });
  }
  const documentsPath = fileManager.getDocumentsPath();
  return joinPathSegmentsWithinRoot(documentsPath, ['.backups'], { resolveSymlinks: false });
}

async function ensureBackupsFolder(fileId, basePath) {
  const root = getBackupsRoot(basePath);
  const backupsPath = joinPathSegmentsWithinRoot(root, [fileId], { resolveSymlinks: false });
  await fs.mkdir(backupsPath, { recursive: true });
  return backupsPath;
}

async function createBackup(filePath, content, options = {}) {
  try {
    const basePath = options && options.basePath ? options.basePath : null;
    const safeFilePath = resolveValidatedPath(filePath, { mode: 'any' });
    const fileId = crypto.createHash('sha256').update(safeFilePath).digest('hex');
    const backupsPath = await ensureBackupsFolder(fileId, basePath);
    await writeMetaFile(backupsPath, safeFilePath);

    const fileName = path.basename(safeFilePath);
    const timestamp = Date.now();
    const backupFileName = `${timestamp}_${fileName}`;
    const backupPath = joinPathSegmentsWithinRoot(backupsPath, [backupFileName], { resolveSymlinks: false });
    const writeResult = await fileManager.writeFileAtomic(backupPath, content);
    if (!writeResult.success) {
      return writeResult;
    }

    await cleanupOldBackups(backupsPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function cleanupOldBackups(backupsPath) {
  try {
    const files = await fs.readdir(backupsPath);
    const backupFiles = files.filter((file) => file !== 'meta.json');

    if (backupFiles.length > 50) {
      backupFiles.sort();
      const toDelete = backupFiles.slice(0, backupFiles.length - 50);
      for (const file of toDelete) {
        await fs.unlink(joinPathSegmentsWithinRoot(backupsPath, [file], { resolveSymlinks: false }));
      }
    }
  } catch (error) {
    // Тихая обработка ошибок
  }
}

async function writeMetaFile(backupsPath, filePath) {
  try {
    const metaPath = joinPathSegmentsWithinRoot(backupsPath, ['meta.json'], { resolveSymlinks: false });
    const meta = {
      originalPath: filePath,
      baseName: path.basename(filePath)
    };
    await fileManager.writeFileAtomic(metaPath, JSON.stringify(meta, null, 2));
  } catch {
    // Игнорируем сбои записи meta
  }
}

module.exports = {
  getBackupsRoot,
  ensureBackupsFolder,
  createBackup
};
