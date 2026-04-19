const mongoose = require('mongoose');
require('dotenv').config();
const Claim = require('./models/Claim');

async function testDatabase() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected successfully!');
  
  const claims = await Claim.find({}, 'claimId patient status amount').lean();
  console.log('\n🚀 DATA SUCCESSFULLY MIGRATED TO MONGODB 🚀');
  console.table(claims);
  
  process.exit(0);
}

testDatabase().catch(err => {
  console.error("Database connection failed:", err);
  process.exit(1);
});
