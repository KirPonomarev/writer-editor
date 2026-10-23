// Main's fixed ArchiveDirectoryPublicationPort. No command interpreter,
// recursive operations, arbitrary flags, privileges or replacement fallback.
#include <sys/stat.h>
#include <sys/attr.h>
#include <sys/stdio.h>
#include <sys/types.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int result(int ok, const char *phase, int error, int published, int synced) {
  printf("{\"schemaVersion\":1,\"ok\":%s,\"phase\":\"%s\",\"errno\":%d,\"namePublished\":%s,\"directorySynced\":%s}\n",
    ok ? "true" : "false", phase, error, published ? "true" : "false", synced ? "true" : "false");
  return ok ? 0 : 1;
}
static int number(const char *text, uint64_t *value) {
  if (!text[0] || strlen(text) > 20) return 0;
  for (const char *p = text; *p; ++p) if (*p < '0' || *p > '9') return 0;
  errno = 0; char *end; unsigned long long n = strtoull(text, &end, 10);
  if (errno || *end) return 0;
  *value = (uint64_t)n; return 1;
}
static int basename_ok(const char *text) {
  return text[0] && strlen(text) <= NAME_MAX && !strchr(text, '/')
    && !strchr(text, '\\') && strcmp(text, ".") && strcmp(text, "..");
}
static int matches(const struct stat *st, uint64_t dev, uint64_t ino) {
  return (uint64_t)st->st_dev == dev && (uint64_t)st->st_ino == ino && S_ISDIR(st->st_mode);
}
static int matches_source(const struct stat *st, uint64_t dev, uint64_t ino, int regular_file) {
  return regular_file ? (uint64_t)st->st_dev == dev && (uint64_t)st->st_ino == ino
    && S_ISREG(st->st_mode) && st->st_nlink == 1 && st->st_size >= 0 && st->st_size <= 8 * 1024 * 1024
    : matches(st, dev, ino);
}
static int file_capability(int argc, char **argv) {
  uint64_t dev, ino;
  if (argc != 5 || argv[2][0] != '/' || strlen(argv[2]) >= PATH_MAX
    || !number(argv[3], &dev) || !number(argv[4], &ino)) return result(0, "INPUT", EINVAL, 0, 0);
  int parent = open(argv[2], O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (parent < 0) return result(0, "PARENT_OPEN", errno, 0, 0);
  struct stat observed, spelled;
  if (fstat(parent, &observed) || lstat(argv[2], &spelled)
    || !matches(&observed, dev, ino) || !matches(&spelled, dev, ino)) {
    close(parent); return result(0, "PARENT_IDENTITY", ESTALE, 0, 0);
  }
  struct attrlist attrs = {0}; attrs.bitmapcount = ATTR_BIT_MAP_COUNT;
  attrs.volattr = ATTR_VOL_INFO | ATTR_VOL_CAPABILITIES;
  struct { uint32_t length; vol_capabilities_attr_t caps; } info = {0};
  if (fgetattrlist(parent, &attrs, &info, sizeof(info), 0)) {
    int error = errno; close(parent); return result(0, "CAPABILITY_READ", error, 0, 0);
  }
  if (fstat(parent, &observed) || lstat(argv[2], &spelled)
    || !matches(&observed, dev, ino) || !matches(&spelled, dev, ino)) {
    close(parent); return result(0, "PARENT_IDENTITY", ESTALE, 0, 0);
  }
  close(parent);
  if (info.length != sizeof(info) || !(info.caps.valid[VOL_CAPABILITIES_INTERFACES] & VOL_CAP_INT_RENAME_EXCL))
    return result(0, "CAPABILITY_UNKNOWN", ENOTSUP, 0, 0);
  if (!(info.caps.capabilities[VOL_CAPABILITIES_INTERFACES] & VOL_CAP_INT_RENAME_EXCL))
    return result(0, "CAPABILITY_UNAVAILABLE", ENOTSUP, 0, 0);
  return result(1, "CAPABILITY_AVAILABLE", 0, 0, 0);
}
int main(int argc, char **argv) {
  if (argc > 1 && !strcmp(argv[1], "--regular-file-capability")) return file_capability(argc, argv);
  int regular_file = argc == 9 && !strcmp(argv[1], "--regular-file");
  if (regular_file) { ++argv; --argc; }
  uint64_t parent_dev, parent_ino, source_dev, source_ino;
  if (argc != 8 || argv[1][0] != '/' || strlen(argv[1]) >= PATH_MAX
    || !basename_ok(argv[2]) || !basename_ok(argv[3]) || !strcmp(argv[2], argv[3])
    || !number(argv[4], &parent_dev) || !number(argv[5], &parent_ino)
    || !number(argv[6], &source_dev) || !number(argv[7], &source_ino)) return result(0, "INPUT", EINVAL, 0, 0);
  int parent = open(argv[1], O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (parent < 0) return result(0, "PARENT_OPEN", errno, 0, 0);
  struct stat ps, spelled, source;
  if (fstat(parent, &ps) || lstat(argv[1], &spelled)
    || !matches(&ps, parent_dev, parent_ino) || !matches(&spelled, parent_dev, parent_ino)) {
    close(parent); return result(0, "PARENT_IDENTITY", ESTALE, 0, 0);
  }
  if (fstatat(parent, argv[2], &source, AT_SYMLINK_NOFOLLOW)
    || !matches_source(&source, source_dev, source_ino, regular_file) || source_dev != parent_dev) {
    close(parent); return result(0, "SOURCE_IDENTITY", ESTALE, 0, 0);
  }
  // The kernel performs the absence test and publication in ONE operation.
  // RENAME_EXCL preserves an existing destination, including an empty directory.
  if (renameatx_np(parent, argv[2], parent, argv[3], RENAME_EXCL)) {
    int error = errno; close(parent); return result(0, "PUBLICATION", error, 0, 0);
  }
  struct stat final;
  if (fstatat(parent, argv[3], &final, AT_SYMLINK_NOFOLLOW)
    || !matches_source(&final, source_dev, source_ino, regular_file)) {
    close(parent); return result(0, "FINAL_IDENTITY", ESTALE, 1, 0);
  }
  if (fsync(parent)) { int error = errno; close(parent); return result(0, "DIRECTORY_SYNC", error, 1, 0); }
  if (lstat(argv[1], &spelled) || !matches(&spelled, parent_dev, parent_ino)) {
    close(parent); return result(0, "PARENT_RELOCATED", ESTALE, 1, 1);
  }
  close(parent); return result(1, "PUBLISHED", 0, 1, 1);
}
