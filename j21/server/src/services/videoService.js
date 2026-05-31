import { minioClient, BUCKET_NAME } from '../config/minio.js';

export const uploadVideo = async (file, fileId) => {
  const metaData = {
    'Content-Type': file.mimetype,
  };

  await minioClient.putObject(
    BUCKET_NAME,
    fileId,
    file.buffer,
    file.size,
    metaData
  );

  return fileId;
};

export const getVideoUrl = async (fileId, expires = 604800) => {
  const url = await minioClient.presignedGetObject(
    BUCKET_NAME,
    fileId,
    expires
  );
  return url;
};

export const deleteVideo = async (fileId) => {
  await minioClient.removeObject(BUCKET_NAME, fileId);
};
