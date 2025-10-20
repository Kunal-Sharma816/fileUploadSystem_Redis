import mongoose from "mongoose";

const DatasetSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },

    originalName: {
        type: String,
        required: true
    },

    fileSize: {
        type: Number,
        required: true
    },

    mimeType: {
        type: String,
        required: true
    },

    // Type of file: 'dataset', 'image', 'mixed'
    fileType: {
        type: String,
        enum: ['dataset', 'image', 'document'],
        default: 'dataset'
    },

    // For datasets (CSV, JSON, Excel)
    data: {
        type: String, // Base64 or reference to storage
    },

    // For images - store optimized version
    imageData: {
        thumbnail: String, // Base64 thumbnail
        compressed: String, // Base64 compressed image
        dimensions: {
            width: Number,
            height: Number
        }
    },

    preview: {
        headers: [String],
        rows: [[String]],
        totalRows: Number,
        totalColumns: Number
    },

    // Batch upload tracking
    batchInfo: {
        totalBatches: Number,
        uploadedBatches: Number,
        batchSize: Number,
        isComplete: {
            type: Boolean,
            default: false
        }
    },

    status: {
        type: String,
        enum: ['pending', 'uploading', 'processing', 'finalized', 'expired', 'failed'],
        default: 'pending'
    },

    uploadedAt: {
        type: Date,
        default: Date.now
    },

    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    },

    finalizedAt: {
        type: Date
    },

    // Redis upload ID for tracking
    redisUploadId: {
        type: String
    }

}, {
    timestamps: true
});

// TTL index - only deletes documents where expiresAt is in the past
DatasetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
DatasetSchema.index({ redisUploadId: 1 });
DatasetSchema.index({ status: 1 });

export default mongoose.models.Dataset || mongoose.model('Dataset', DatasetSchema);