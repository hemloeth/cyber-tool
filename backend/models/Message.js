import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      default: 'default_session',
      index: true
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant', 'system']
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    scanData: {
      type: mongoose.Schema.Types.Mixed,
      required: false
    }
  },
  {
    timestamps: true
  }
);

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
