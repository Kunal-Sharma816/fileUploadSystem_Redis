import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

if (!process.env.REDIS_URL) {
  console.warn('⚠️  REDIS_URL not found in .env.local, using default: redis://localhost:6379');
}

// Create Redis client with connection pooling
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

// Helper functions for Redis operations
export const redisHelpers = {
  // Store file chunks in Redis with expiration
  async storeFileChunk(uploadId, chunkIndex, data, expirySeconds = 3600) {
    const key = `upload:${uploadId}:chunk:${chunkIndex}`;
    await redis.setex(key, expirySeconds, data);
    return key;
  },

  // Get file chunk from Redis
  async getFileChunk(uploadId, chunkIndex) {
    const key = `upload:${uploadId}:chunk:${chunkIndex}`;
    return await redis.get(key);
  },

  // Store upload metadata
  async storeUploadMetadata(uploadId, metadata, expirySeconds = 3600) {
    const key = `upload:${uploadId}:metadata`;
    await redis.setex(key, expirySeconds, JSON.stringify(metadata));
    return key;
  },

  // Get upload metadata
  async getUploadMetadata(uploadId) {
    const key = `upload:${uploadId}:metadata`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  // Store image preview in Redis (with compression)
  async storeImagePreview(uploadId, imageData, expirySeconds = 1800) {
    const key = `preview:image:${uploadId}`;
    await redis.setex(key, expirySeconds, imageData);
    return key;
  },

  // Get image preview
  async getImagePreview(uploadId) {
    const key = `preview:image:${uploadId}`;
    return await redis.getBuffer(key);
  },

  // Store dataset preview (parsed data)
  async storeDatasetPreview(uploadId, previewData, expirySeconds = 1800) {
    const key = `preview:dataset:${uploadId}`;
    await redis.setex(key, expirySeconds, JSON.stringify(previewData));
    return key;
  },

  // Get dataset preview
  async getDatasetPreview(uploadId) {
    const key = `preview:dataset:${uploadId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  // Track upload progress
  async setUploadProgress(uploadId, progress) {
    const key = `upload:${uploadId}:progress`;
    await redis.setex(key, 3600, JSON.stringify(progress));
  },

  // Get upload progress
  async getUploadProgress(uploadId) {
    const key = `upload:${uploadId}:progress`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  // Delete all keys related to an upload
  async cleanupUpload(uploadId) {
    const pattern = `*:${uploadId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  // Store complete file temporarily
  async storeCompleteFile(uploadId, fileBuffer, expirySeconds = 1800) {
    const key = `upload:${uploadId}:complete`;
    await redis.setex(key, expirySeconds, fileBuffer);
    return key;
  },

  // Get complete file
  async getCompleteFile(uploadId) {
    const key = `upload:${uploadId}:complete`;
    return await redis.getBuffer(key);
  }
};

export default redis;