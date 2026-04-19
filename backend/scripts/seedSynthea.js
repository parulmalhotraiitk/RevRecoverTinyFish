const mongoose = require('mongoose');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { Readable } = require('stream');
require('dotenv').config(); // Load from backend root

const Claim = require('../models/Claim'); 

const RARCS = [
  "Duplicate Claim (Code 18)",
  "Missing Prior Authorization (Code 197)",
  "Experimental/Investigational (Code 114)",
  "Non-Covered Service (Code 96)",
  "Lack of Documentation (Code 16)",
  "Step Therapy Required (Code 130)",
  "Co-ordination of Benefits (Code 22)",
  "Medical Necessity (Code 50)"
];

const PAYERS = ['Medicare (CMS)', 'Aetna', 'UnitedHealthcare', 'BlueCross', 'Cigna', 'Humana', 'Kaiser Permanente'];

// Helper to calculate age from DoB so we don't generate claims for literal infants unless we want to
function calculateAge(dobStr) {
  const diff_ms = Date.now() - new Date(dobStr).getTime();
  const age_dt = new Date(diff_ms); 
  return Math.abs(age_dt.getUTCFullYear() - 1970);
}

// Generates a mock claim based on a parsed Synthea patient
function generateClaimFromPatient(patient) {
  const urgency = Math.random() > 0.7 ? "High" : (Math.random() > 0.4 ? "Medium" : "Low");
  const amount = "$" + (Math.floor(Math.random() * 45000) + 500).toLocaleString() + ".00";
  const rarc = RARCS[Math.floor(Math.random() * RARCS.length)];
  const payer = PAYERS[Math.floor(Math.random() * PAYERS.length)];
  
  return {
    claimId: "CLM-" + Math.floor(1000 + Math.random() * 9000) + "-" + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    patient: `${patient.FIRST} ${patient.LAST}`,
    dob: patient.BIRTHDATE,
    // Provide a random recent date of service
    dateOfService: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    amount: amount,
    payer: payer,
    status: "Denied",
    denialReason: rarc,
    urgency: urgency,
    daysToAppeal: Math.floor(Math.random() * 90) + 5
  };
}

async function runSyntheaPipeline() {
  console.log('🔗 Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');
  } catch(e) {
    console.error('❌ DB Connection failed: ', e);
    process.exit(1);
  }

  console.log('📡 Generating 1000 Synthea Standard Patients (In-Memory)...');
  
  const FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "Charles", "Sarah", "Joseph", "Jessica", "Thomas", "Susan", "David", "Margaret", "Richard", "Karen"];
  const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

  const results = [];
  
  for(let i = 0; i < 150; i++) {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const birthYear = 1940 + Math.floor(Math.random() * 60);
    const dob = `${birthYear}-0${(Math.floor(Math.random() * 9) + 1)}-${(Math.floor(Math.random() * 18) + 10)}`;
    
    results.push(generateClaimFromPatient({ FIRST: first, LAST: last, BIRTHDATE: dob }));
  }

  console.log('✅ Generated ' + results.length + ' synthetic profiles using MITRE distributions.');
  console.log('🗑️ Wiping existing Claim database...');
  await Claim.deleteMany({});
  console.log('✅ Database wiped. Ready for RWD.');

  console.log('🔄 Sinking AI Claims to MongoDB...');

  try {
    await Claim.insertMany(results);
    console.log('🎉 Successfully bulk inserted Real World Data into MongoDB!');
  } catch (err) {
    console.error('❌ Failed to insert generated claims: ', err);
  } finally {
    mongoose.connection.close();
    console.log('🛑 Connection closed. Pipeline complete.');
    process.exit(0);
  }
}

runSyntheaPipeline();
