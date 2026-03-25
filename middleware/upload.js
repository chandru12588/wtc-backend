import multer from "multer";

const bytes = (mb) => Number(mb || 0) * 1024 * 1024;

export const createMemoryUpload = ({
  maxFileSizeMB = 3000,
  allowImages = true,
  allowVideos = false,
  allowPdf = false,
} = {}) => {
  const fileFilter = (_req, file, cb) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");
    const isPdf = mime === "application/pdf";
    const allowed =
      (allowImages && isImage) ||
      (allowVideos && isVideo) ||
      (allowPdf && isPdf);

    if (!allowed) {
      const err = new Error("Unsupported file format");
      err.statusCode = 400;
      return cb(err);
    }

    return cb(null, true);
  };

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: bytes(maxFileSizeMB) },
    fileFilter,
  });
};
