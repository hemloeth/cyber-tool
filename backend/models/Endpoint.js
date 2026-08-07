import mongoose from 'mongoose';

const endpointSchema = new mongoose.Schema(
  {
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      required: true,
      index: true
    },
    url: {
      type: String,
      required: true
    },
    method: {
      type: String,
      default: 'GET',
      uppercase: true
    },
    parameters: [
      {
        type: String
      }
    ],
    source: {
      type: String,
      enum: ['html', 'javascript', 'form'],
      default: 'html'
    },
    inspectElementHTML: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);


export const Endpoint = mongoose.models.Endpoint || mongoose.model('Endpoint', endpointSchema);
