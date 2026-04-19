const mongoose = require('mongoose');

const AgentRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  claimId: { type: String, required: true },
  payer: { type: String },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'unknown'], default: 'queued' },
  mode: { type: String, enum: ['turbo', 'full'] },
  targetUrl: { type: String },
  result: { type: mongoose.Schema.Types.Mixed },
  logs: [{
    timestamp: { type: Date, default: Date.now },
    event: { type: String },
    data: { type: mongoose.Schema.Types.Mixed }
  }],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('AgentRun', AgentRunSchema);
