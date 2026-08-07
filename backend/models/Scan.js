import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema(
  {
    targetUrl: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending'
    },
    urlsDiscoveredCount: {
      type: Number,
      default: 0
    },
    error: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const Scan = mongoose.models.Scan || mongoose.model('Scan', scanSchema);
