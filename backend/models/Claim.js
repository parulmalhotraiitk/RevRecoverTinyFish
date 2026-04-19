const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
  claimId: { type: String, required: true, unique: true },
  patient: { type: String, required: true },
  amount: { type: String, required: true },
  status: { type: String, enum: ['Denied', 'Appealing', 'Completed', 'Failed'], default: 'Denied' },
  payer: { type: String, required: true },
  denialReason: { type: String },
  priorAuthCode: { type: String },
  justification: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Claim', ClaimSchema);
