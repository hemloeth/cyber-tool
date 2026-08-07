import mongoose from 'mongoose';

const formSchema = new mongoose.Schema(
  {
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      required: true,
      index: true
    },
    endpoint: {
      type: String,
      required: true
    },
    method: {
      type: String,
      default: 'POST',
      uppercase: true
    },
    inputs: [
      {
        name: String,
        type: { type: String, default: 'text' }
      }
    ]
  },
  {
    timestamps: true
  }
);

export const Form = mongoose.models.Form || mongoose.model('Form', formSchema);
