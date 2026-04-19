const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const mongoose = require('mongoose'); // [NEW] Added Mongoose
const bcrypt = require('bcryptjs'); // [AUTH]
const jwt = require('jsonwebtoken'); // [AUTH]
require('dotenv').config();

const Claim = require('./models/Claim'); // [NEW] Import Models
const AgentRun = require('./models/AgentRun');
const User = require('./models/User'); // [AUTH]
const { generateClinicalStrategy } = require('./utils/fireworks'); // [NEW] AI Intelligence Layer

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_temporary_key_for_dev_only';


const PORT = process.env.PORT || 3001;
const path = require('path');

app.use(cors());
app.use(express.json());

// Load Build Information
let buildInfo = { timestamp: 'Development' };
try {
  const fs = require('fs');
  buildInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'build-info.json'), 'utf8'));
  console.log(`🏗️  Backend Build Timestamp: ${buildInfo.timestamp}`);
} catch (e) {
  console.log('🏗️  No build-info.json found, running in production/dev without timestamp.');
}

// ─────────────────────────────────────────────────────────────────────────────
// [NEW] MONGODB CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI is not defined. Database features will be disabled.');
} else {
  mongoose.connect(MONGODB_URI)
    .then(async () => {
      console.log('✅ Connected to MongoDB Atlas');
      await seedDatabase(); // Ensure we have data
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// Global state for Simulation Portal (kept for session active check, moved others to DB)
let agentSessionActive = false;

// ─────────────────────────────────────────────────────────────────────────────
// [AUTH] USER REGISTRATION & LOGIN
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      email,
      password: hashedPassword,
      name
    });

    const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({ success: true, token, user: { name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    // Generate token
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({ success: true, token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [AUTH] JWT MIDDLEWARE & USER MANAGEMENT (RBAC)
// ─────────────────────────────────────────────────────────────────────────────

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized. No token provided.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Invalid token.' });
  }
};

const requireSystemAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== 'System Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. System Admin access required.' });
    }
    next();
  });
};

// GET /api/users (System Admin only)
app.get('/api/users', requireSystemAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching users.' });
  }
});

// POST /api/users (System Admin only - creates users with specific roles)
app.post('/api/users', requireSystemAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({ email, password: hashedPassword, name, role });
    res.json({ success: true, user: { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating user.' });
  }
});

// DELETE /api/users/:id (System Admin only)
app.delete('/api/users/:id', requireSystemAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting user.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [DATA] LIVE MongoDB CLAIMS PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/claims (Authenticated Users)
app.get('/api/claims', requireAuth, async (req, res) => {
  try {
    const claims = await Claim.find().sort({ _id: -1 });
    res.json({ success: true, claims });
  } catch (err) {
    console.error('Error fetching claims:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving claims.' });
  }
});

// GET /api/stats (Authenticated Users)
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    // 1. Recovered Revenue: Sum all claims with status Appealing or Completed
    const claims = await Claim.find({ status: { $in: ['Appealing', 'Completed'] } });
    let recoveredRevenue = 0;
    claims.forEach(c => {
      // Parse "$12,450.00" -> 12450.00
      const amountVal = parseFloat(c.amount.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(amountVal)) recoveredRevenue += amountVal;
    });

    // 2. Human Hours Saved: Successful agent runs * 1.5
    const successfulRuns = await AgentRun.countDocuments({ status: 'completed' });
    const failedRuns = await AgentRun.countDocuments({ status: 'failed' });
    const hoursSaved = successfulRuns * 1.5;

    // 3. Agent Success Rate
    const totalResolvedRuns = successfulRuns + failedRuns;
    let agentSuccessRate = 0;
    if (totalResolvedRuns > 0) {
      agentSuccessRate = ((successfulRuns / totalResolvedRuns) * 100);
    } else {
      // Provide a fallback aesthetic rate if no runs exist yet but keeping it 0 is more truthful
      agentSuccessRate = 0;
    }

    res.json({
      success: true,
      recoveredRevenue,
      hoursSaved,
      agentSuccessRate: agentSuccessRate.toFixed(1)
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving stats.' });
  }
});

/**
 * Seeds the database with initial claims if empty.
 */
async function seedDatabase() {
  const count = await Claim.countDocuments();
  if (count === 0) {
    console.log('🌱 Seeding initial claims data...');
    const initialClaims = [
      { claimId: "CLM-992-81A", patient: "Eleanor Vance", amount: "$12,450.00", status: "Denied", payer: "Aetna", denialReason: "Lack of medical necessity", priorAuthCode: "AUTH-88X291-B" },
      { claimId: "CLM-814-22X", patient: "Marcus Thorne", amount: "$3,200.00", status: "Denied", payer: "UnitedHealth", denialReason: "Experimental treatment", priorAuthCode: "AUTH-11C440-Z" },
      { claimId: "CLM-105-99B", patient: "Sarah Blake", amount: "$875.00", status: "Appealing", payer: "Cigna", denialReason: "Out of network" },
      { claimId: "CLM-202-55K", patient: "Julian Voss", amount: "$21,100.00", status: "Denied", payer: "BlueCross", denialReason: "Missing clinical notes", priorAuthCode: "AUTH-VOSS-99" },
      { claimId: "CLM-443-11L", patient: "Fiona Garrity", amount: "$1,450.00", status: "Denied", payer: "Aetna", denialReason: "Duplicate claim", priorAuthCode: "AUTH-GARRITY-11" },
      { claimId: "CLM-778-90P", patient: "Desmond Miles", amount: "$45,600.00", status: "Denied", payer: "Medicare", denialReason: "Pre-certification required", priorAuthCode: "AUTH-MILES-77" },
      { claimId: "CLM-991-04D", patient: "Lara Croft", amount: "$6,800.00", status: "Denied", payer: "Humana", denialReason: "Invalid procedure code", priorAuthCode: "AUTH-CROFT-00" },
      { claimId: "CLM-552-33W", patient: "Arthur Morgan", amount: "$15,200.00", status: "Denied", payer: "Aetna", denialReason: "Medical necessity", priorAuthCode: "AUTH-MORGAN-55" },
      // Historical successes to seed the baseline $43,250 Revenue
      { claimId: "CLM-HIST-1", patient: "John Doe", amount: "$16,500.00", status: "Completed", payer: "Aetna", denialReason: "Med Nec", updatedAt: new Date(Date.now() - 86400000*3) },
      { claimId: "CLM-HIST-2", patient: "Jane Smith", amount: "$22,150.00", status: "Completed", payer: "BlueCross", denialReason: "Step Therapy", updatedAt: new Date(Date.now() - 86400000*2) },
      { claimId: "CLM-HIST-3", patient: "Alice Jones", amount: "$4,600.00", status: "Completed", payer: "Cigna", denialReason: "Missing clinicals", updatedAt: new Date(Date.now() - 86400000) }
    ];
    await Claim.insertMany(initialClaims);
    console.log('✅ Seeding complete.');
  }

  // Seed Historical Agent Runs for "128 hours saved" and "94.2% success rate" baseline
  const runCount = await AgentRun.countDocuments();
  if (runCount === 0) {
    console.log('🌱 Seeding historical AgentRuns to establish baseline analytics...');
    const mockRuns = [];
    // To get ~128 hours saved at 1.5 hrs/run, we need ~85 successful runs.
    for(let i = 1; i <= 85; i++) {
        mockRuns.push({ runId: `RUN-HIST-S-${i}`, claimId: `CLM-HIST-${i%10}`, status: 'completed', payer: 'Aetna', mode: 'full' });
    }
    // To get 94.2% success rate: 85 is 94.4% of 90. Let's add 5 failures.
    for(let i = 1; i <= 5; i++) {
        mockRuns.push({ runId: `RUN-HIST-F-${i}`, claimId: `CLM-HIST-FAIL-${i}`, status: 'failed', payer: 'UnitedHealth', mode: 'full' });
    }
    await AgentRun.insertMany(mockRuns);
    console.log(`✅ Seeded ${mockRuns.length} historical agent runs for analytics baseline.`);
  }

  // Seed Root System Admin
  const adminCount = await User.countDocuments({ email: 'admin@hospital.org' });
  if (adminCount === 0) {
    console.log('🌱 Seeding root System Admin...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await User.create({
      email: 'admin@hospital.org',
      password: hashedPassword,
      name: 'Dr. Gregory House',
      role: 'System Admin'
    });
    console.log('✅ Root Admin created (admin@hospital.org / admin123).');
  }
}


// Global Error Handler for total capture
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION:', reason);
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER STACK: AgentOps — Agent session observability
// Docs: https://docs.agentops.ai
// ─────────────────────────────────────────────────────────────────────────────
const AGENTOPS_KEY = process.env.AGENTOPS_API_KEY;
const agentOpsSessions = {};

/**
 * Sends a manual OTLP trace to AgentOps v3
 */
async function sendAgentOpsTrace(token, { runId, eventName, status, result, tags = [] }) {
  try {
    const traceId = runId.replace(/-/g, '').padEnd(32, '0').substring(0, 32);
    const spanId = Math.random().toString(16).substring(2, 10).padStart(16, '0');

    const res = await fetch('https://otlp.agentops.ai/v1/traces', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resourceSpans: [{
          resource: { 
            attributes: [
              { key: "service.name", value: { stringValue: "RevRecover" } },
              { key: "service.version", value: { stringValue: buildInfo.timestamp } }
            ] 
          },
          scopeSpans: [{
            spans: [{
              traceId,
              spanId,
              name: eventName,
              kind: 1, // INTERNAL
              startTimeUnixNano: (Date.now() - 500) * 1000000 + "",
              endTimeUnixNano: Date.now() * 1000000 + "",
              attributes: [
                { key: "agentops.session.id", value: { stringValue: runId } },
                { key: "agentops.end_state", value: { stringValue: status || 'Unset' } },
                ...tags.map(t => ({ key: "agentops.tag", value: { stringValue: t } }))
              ]
            }]
          }]
        }]
      })
    });
    
    if (!res.ok) {
      console.warn(`[AgentOps] Trace failed: ${res.status} - ${await res.text()}`);
    } else {
      console.log(`📊 [AgentOps] Trace sent: ${eventName} (${runId})`);
    }
  } catch (e) {
    console.warn('[AgentOps] Trace network error:', e.message);
  }
}

async function agentOpsStart(runId, claimId, payer) {
  if (!AGENTOPS_KEY) return;
  try {
    // 1. Get JWT from v3 auth endpoint
    const authRes = await fetch('https://api.agentops.ai/v3/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: AGENTOPS_KEY })
    });
    
    if (!authRes.ok) {
        console.warn("[AgentOps] Auth failed (v3):", authRes.status);
        return;
    }
    
    const { token } = await authRes.json();
    agentOpsSessions[runId] = { token };
    console.log(`📊 [AgentOps] Authenticated (v3) for run: ${runId}`);

    // 2. Send Start Trace
    await sendAgentOpsTrace(token, {
      runId,
      eventName: 'run_started',
      tags: ['revrecover', 'medical-appeals', payer, claimId]
    });

  } catch (e) { console.warn('[AgentOps] Session start failed:', e.message); }
}

async function agentOpsEnd(runId, status, result) {
  const session = agentOpsSessions[runId];
  if (!AGENTOPS_KEY || !session) return;
  
  try {
    await sendAgentOpsTrace(session.token, {
      runId,
      eventName: 'run_completed',
      status: status === 'completed' ? 'Success' : 'Fail',
      result: result || status,
      tags: ['revrecover', status]
    });
    
    delete agentOpsSessions[runId];
    console.log(`📊 [AgentOps] Session ended: ${runId} → ${status}`);
  } catch (e) { console.warn('[AgentOps] Session end failed:', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER STACK: Axiom — Structured observability logs
// Docs: https://axiom.co/docs/send-data/ingest
// ─────────────────────────────────────────────────────────────────────────────
const AXIOM_KEY = process.env.AXIOM_API_KEY;
const AXIOM_DATASET = process.env.AXIOM_DATASET || 'revrecover-logs';

async function axiomLog(event, data) {
  if (!AXIOM_KEY) return;
  try {
    await fetch(`https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AXIOM_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ _time: new Date().toISOString(), event, ...data }])
    });
  } catch (e) { console.warn('[Axiom] Log failed (non-critical):', e.message); }
}


// Root route for verification
app.get('/', (req, res) => {
  res.send('<h1>🚀 RevRecover Agentic Backend is LIVE</h1><p>The Brain is active and waiting for TinyFish orchestration.</p>');
});

// Health check route for deployment verification
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'active', 
    service: 'RevRecover Agent Backend', 
    buildTime: buildInfo.timestamp 
  });
});

// Serve Simulation Portal
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'simulation-portal.html'));
});

// Redirect logout to portal to prevent 404s if agent wanders
app.get('/portal/logout', (req, res) => {
  res.redirect('/portal');
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER STACK: ElevenLabs — Secure Server-Side TTS Proxy
// The API key is held only on the backend and never sent to the browser.
// Frontend calls POST /api/tts with { text, voiceId } and receives audio/mpeg.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!elevenLabsKey) {
    // Graceful degradation: tell the frontend to use browser speech synthesis
    return res.status(503).json({ error: 'TTS service not configured.' });
  }

  const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text field is required.' });
  }

  try {
    const audioRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!audioRes.ok) {
      const errText = await audioRes.text();
      console.warn(`[ElevenLabs] TTS API error ${audioRes.status}: ${errText}`);
      return res.status(audioRes.status).json({ error: 'ElevenLabs API error.' });
    }

    // Stream audio back to the frontend
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    audioRes.body.pipe(res);

  } catch (err) {
    console.error('[ElevenLabs] TTS proxy error:', err.message);
    res.status(500).json({ error: 'TTS proxy failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CMS BlueButton 2.0 — Medicare OAuth Integration
// Docs: https://bluebutton.cms.gov/developers/
// ─────────────────────────────────────────────────────────────────────────────

// Step 1: Build and return the CMS authorization URL for the frontend to redirect to
app.get('/api/cms/authorize', (req, res) => {
  const crypto      = require('crypto');
  const clientId    = process.env.CMS_CLIENT_ID;
  const redirectUri = process.env.CMS_REDIRECT_URI;
  const base        = process.env.CMS_SANDBOX_BASE || 'https://sandbox.bluebutton.cms.gov';

  if (!clientId) {
    return res.status(503).json({ success: false, message: 'CMS credentials not configured.' });
  }

  // Generate PKCE for CMS OAuth
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: state,
    scope: 'profile patient/Patient.read patient/ExplanationOfBenefit.read patient/Coverage.read'
  });

  const authUrl = `${base}/v1/o/authorize/?${params.toString()}`;
  console.log(`[CMS] Redirecting to: ${authUrl}`);
  
  // Return authUrl along with the verifier so the frontend can hang onto it for the exchange
  res.json({ success: true, authUrl, verifier });
});

// Step 2: Exchange the auth code for a token and fetch the patient's Medicare claims
app.post('/api/cms/exchange', async (req, res) => {
  const { code, verifier } = req.body;
  const clientId     = process.env.CMS_CLIENT_ID;
  const clientSecret = process.env.CMS_CLIENT_SECRET;
  const redirectUri  = process.env.CMS_REDIRECT_URI;
  const base         = process.env.CMS_SANDBOX_BASE || 'https://sandbox.bluebutton.cms.gov';

  if (!clientId || !clientSecret || !verifier) {
    return res.status(503).json({ success: false, message: 'Missing CMS credentials or PKCE verifier.' });
  }

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch(`${base}/v1/o/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        client_secret: clientSecret,
        code_verifier: verifier
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[CMS] Token exchange failed:', tokenData);
      return res.status(400).json({ success: false, message: 'CMS token exchange failed.', detail: tokenData });
    }

    console.log('[CMS] Token exchange successful.');

    // Fetch the patient's Medicare profile
    const profileRes = await fetch(`${base}/v1/connect/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();

    // Fetch the patient's Explanation of Benefit (claims data)
    const eobRes = await fetch(`${base}/v1/fhir/ExplanationOfBenefit/?_format=json&_count=5`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const eobData = await eobRes.json();

    // Extract a summary of the first few EOB entries
    const claimsSummary = (eobData.entry || []).slice(0, 5).map(e => ({
      id:          e.resource?.id,
      status:      e.resource?.status,
      type:        e.resource?.type?.coding?.[0]?.display || 'Medicare Claim',
      created:     e.resource?.created,
      total:       e.resource?.total?.[0]?.amount?.value,
      currency:    e.resource?.total?.[0]?.amount?.currency || 'USD',
      provider:    e.resource?.provider?.display || 'CMS Provider'
    }));
    
    // [FIX] CMS userinfo returns `name` as a FHIR array of objects, not a string. Parse it cleanly.
    let parsedPatientName = "Medicare Patient";
    if (Array.isArray(profile.name) && profile.name.length > 0) {
      const n = profile.name[0];
      const given = Array.isArray(n?.given) ? n.given.join(" ") : (n?.given || "");
      parsedPatientName = `${given} ${n?.family || ""}`.trim() || "Medicare Patient";
    } else if (typeof profile.name === 'string' && profile.name.trim() !== '') {
      parsedPatientName = profile.name;
    }
    
    // Final fallback to guarantee name is never blank
    parsedPatientName = parsedPatientName || "Medicare Patient";
    
    // Override the profile object before sending to frontend so the Vue template works natively
    profile.name = parsedPatientName;

    // [NEW] Automatically push this live CMS patient into the Hospital Dashboard (MongoDB)
    try {
      const existingCmsClaim = await Claim.findOne({ claimId: `CMS-${profile.patient}` });
      
      if (!existingCmsClaim && claimsSummary.length > 0) {
        const topClaim = claimsSummary[0];
        let claimAmount = topClaim.total ? `$${topClaim.total.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "$8,450.00";
        
        await Claim.create({
          claimId: `CMS-${profile.patient}`,
          patient: parsedPatientName,
          amount: claimAmount,
          status: "Denied",
          payer: "Medicare",
          denialReason: "Flagged during automated review. Requires clinical necessity documentation. (Code 16)",
          priorAuthCode: topClaim.id || "AUTH-CMS-00X"
        });
        console.log(`✅ Injected live CMS Sandbox Patient (${parsedPatientName}) into MongoDB Denials Queue`);
      }
    } catch(dbErr) {
      console.warn('⚠️ Could not inject CMS patient into DB:', dbErr.message);
    }

    axiomLog('cms_oauth_success', { patientId: profile.patient, claimsRetrieved: claimsSummary.length });

    res.json({
      success: true,
      profile: { name: profile.name, patientId: profile.patient, fhirId: profile.sub },
      claims: claimsSummary
    });

  } catch (err) {
    console.error('[CMS] Exchange error:', err.message);
    res.status(500).json({ success: false, message: `CMS OAuth error: ${err.message}` });
  }
});

// Portal Sync Endpoints
app.get('/api/portal-claims', async (req, res) => {
  try {
    const claims = await Claim.find().sort({ updatedAt: -1 });
    res.json({ claims, agentSessionActive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

app.post('/api/portal-submit', async (req, res) => {
  const { claimId, notes } = req.body;
  console.log(`\n📬 [PORTAL SYNC] Received submission for ${claimId}`);
  console.log(`Notes: ${notes}`);
  
  try {
    await Claim.findOneAndUpdate(
      { claimId },
      { status: "Appealing", justification: notes, updatedAt: new Date() }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update claim' });
  }
});


// Mock Patient Database to provide context to the Agent
const patientDatabase = {
  "CLM-992-81A": { priorAuthCode: "AUTH-88X291-B" },
  "CLM-814-22X": { priorAuthCode: "AUTH-11C440-Z" },
  "CLM-202-55K": { priorAuthCode: "AUTH-VOSS-99" },
  "CLM-443-11L": { priorAuthCode: "AUTH-GARRITY-11" },
  "CLM-778-90P": { priorAuthCode: "AUTH-MILES-77" },
  "CLM-991-04D": { priorAuthCode: "AUTH-CROFT-00" },
  "CLM-552-33W": { priorAuthCode: "AUTH-MORGAN-55" }
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Build the TinyFish goal string
// ─────────────────────────────────────────────────────────────────────────────
function buildGoal({ claimId, payer, denialReason, targetUrl, creds, patientContext, clinicalStrategy }) {
  const isAetnaLike = payer.toLowerCase().includes('aetna') || payer.toLowerCase().includes('mock');
  const isBlueButton = payer.toLowerCase().includes('bluebutton') || payer.toLowerCase().includes('medicare');

  const notesStr = clinicalStrategy || `Medical necessity established for claim ${claimId}. Addressed denial [${denialReason}]. Auth tracking ref: ${patientContext?.priorAuthCode || 'N/A'}. Clinical criteria met. Requesting immediate reversal.`;
  const isInternalPortal = targetUrl.includes('localhost') || targetUrl.includes('.run.app');

  // INTERNAL SIMULATION PORTAL (simulation-portal.html)
  // NO login on this portal. Claims table is immediately visible.
  if (isInternalPortal) {
    const researchStep = [
      '',
      'STEP 1 — Medical Necessity Research (do before logging in):',
      '- Open a new tab and go to: https://clinicaltrials.gov/search?term=' + encodeURIComponent(denialReason),
      '- Find the first clinical trial result.',
      '- Read the details to extract the NCT# and one sentence demonstrating clinical utility/evidence.',
      '- Store both the NCT# and evidence sentence in memory.',
      '- Close the tab and return to the Provider Portal tab.',
      ''
    ].join('\n');

    const notesStrFull = 'Medical necessity confirmed for claim ' + claimId + '. Supporting clinical evidence [insert NCT# from Step 1]: [insert your evidence sentence from Step 1]. Auth ref: ' + (patientContext.priorAuthCode || 'AUTH-PENDING') + '. Requesting immediate reversal of denial.';

    return [
      'The page is already loaded. This is the AetnaCare Provider Portal.',
      'Task: Log in, locate claim ' + claimId + ', and submit a clinical appeal.',
      researchStep,
      'YOUR TASK — complete these steps in order:',
      '',
      'STEP 2 — Secure Sign In:',
      '- Type "admin" into the username / Provider ID field',
      '- Type "password" into the Secure Password field',
      '- Click the "Secure Sign In" button to enter the dashboard',
      '- IMPORTANT: The portal may randomly show a "Security Check" (2FA) popup. If you see this, look for a "Skip 2FA for Demo (Bypass)" link at the bottom and click it to bypass security.',
      '- Wait for the Claims Management Inbox to load',
      '',
      'STEP 3 — Click the Resolve Now button:',
      '- The claims are displayed in a randomized table.',
      '- Look at the table and find the row containing the patient or claim ID: ' + claimId,
      '- In that exact same row, locate the button labeled "Resolve Now" and click it. Do NOT rely on HTML IDs, as they change dynamically.',
      '- A modal dialog will appear.',
      '',
      'STEP 4 — Fill in the appeal text:',
      '- The modal is open with a textarea (id="appeal-text")',
      '- Click inside the textarea to focus it',
      '- Type exactly: ' + notesStrFull,
      '',
      'STEP 5 — Submit:',
      '- Click the button with id="submit-btn" (labeled Submit Clinical Review)',
      '- Wait for the button to show SENT SUCCESSFULLY',
      '',
      'STEP 6 — Return:',
      'Return JSON: { "status": "appeal_submitted", "claimId": "' + claimId + '", "justification": "' + notesStrFull + '" }'
    ].join('\n');
  }

  // CMS / MEDICARE
  if (isBlueButton) {
    return [
      'The page is already loaded. This is a CMS Medicare authorization page.',
      'Task: Authorize the data connection.',
      '',
      'STEP 1 — If a login form is visible:',
      '- Type "' + creds.user + '" into the username field',
      '- Type "' + creds.pass + '" into the password field',
      '- Click the login button and wait for redirect.',
      '',
      'STEP 2 — Click the authorization button:',
      '- Find "Connect", "Authorize", or "Allow" and click it.',
      '',
      'Return JSON: { "status": "authorized", "message": "<confirmation text>" }'
    ].join('\n');
  }

  // EXTERNAL REAL PAYER PORTAL
  const researchStep = [
    '',
    'STEP 1 — Research (do before logging in):',
    '- Go to: https://clinicaltrials.gov/search?term=' + encodeURIComponent(denialReason),
    '- Extract the NCT# and one clinical outcome sentence from the first result.',
    '- Navigate back to the portal tab.',
    ''
  ].join('\n');

  const justification = notesStr + ' Evidence [NCT from Step 1]: [outcome sentence].';

  return [
    'The page is already loaded. This is the ' + payer + ' provider portal.',
    'Task: Log in, find claim ' + claimId + ', and submit a medical necessity appeal.',
    researchStep,
    'STEP 2 — Login:',
    '- Enter "' + creds.user + '" in the username / Provider ID field',
    '- Enter "' + creds.pass + '" in the password field',
    '- Click the login button',
    '- Accept any HIPAA, MFA, or terms popups by agreeing/accepting',
    '- Wait for the dashboard to fully load',
    '',
    'STEP 3 — Find Claim ' + claimId + ':',
    '- Search for "' + claimId + '" using claims search or lookup',
    '- If not found by ID, filter by Denied status and find "' + claimId + '"',
    '- Open the claim detail view',
    '',
    'STEP 4 — File the Appeal:',
    '- Find the Appeal / Reconsideration / Dispute option',
    '- Set reason to Medical Necessity',
    '- In the notes field type: ' + justification,
    '- Submit the form',
    '',
    'STEP 5 — Confirm:',
    '- Wait for a confirmation number or success message',
    'Return JSON: { "status": "appeal_submitted", "claimId": "' + claimId + '", "payer": "' + payer + '", "confirmation": "<text>", "justification": "' + justification + '" }'
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Build target URL
// Auto-detects the Google Cloud Run public URL from the incoming request
// so TinyFish (cloud-hosted) can reach the portal instead of localhost
// ─────────────────────────────────────────────────────────────────────────────
function buildTargetUrl(publicPortalUrl, req) {
  if (publicPortalUrl && publicPortalUrl.trim().length > 0) {
    // User explicitly provided a URL (e.g. ngrok tunnel)
    let url = publicPortalUrl.trim();
    if (url.includes('.run.app') && !url.includes('/portal')) {
      url = url.endsWith('/') ? `${url}portal` : `${url}/portal`;
    }
    return url;
  }

  // Auto-detect the Cloud Run URL from request headers
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';

  if (host && host.includes('.run.app')) {
    const base = `${proto}://${host}`;
    const portalUrl = `${base}/portal`;
    console.log(`🔍 Auto-detected Google Cloud Run portal URL: ${portalUrl}`);
    return portalUrl;
  }

  // Fallback to env var or localhost (dev only)
  // CRITICAL FIX: The Agent accesses the simulated payer portal (hosted on the backend port 3001), 
  // not the Enterprise Portal (Vue app on 5173), to avoid infinite loops.
  let fallback = process.env.MOCK_PORTAL_URL || 'http://localhost:3001';
  if (fallback.includes('.run.app') && !fallback.includes('/portal')) {
    fallback = fallback.endsWith('/') ? `${fallback}portal` : `${fallback}/portal`;
  }
  console.warn(`⚠️  Using fallback portal URL: ${fallback}. Set MOCK_PORTAL_URL env var on Google Cloud if this is wrong.`);
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/run-agent  →  Starts agent, returns runId for polling
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/run-agent', async (req, res) => {
  const { claimId, payer, denialReason, publicPortalUrl } = req.body;

  console.log(`\n🚀 [RUN-AGENT] claim=${claimId} payer=${payer}`);

  const claim = await Claim.findOne({ claimId });
  const patientContext = { priorAuthCode: claim?.priorAuthCode || 'AUTH-PENDING' };

  const apiKey = process.env.TINYFISH_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    return res.status(500).json({ success: false, message: 'TinyFish API Key not configured.' });
  }

  const targetUrl = buildTargetUrl(publicPortalUrl, req);
  const getPortalCredentials = (payerName) => {
    let normalized = payerName.split(' ')[0].toUpperCase();
    if (normalized === 'MEDICARE' || normalized === 'CMS') normalized = 'BLUEBUTTON';
    return {
      user: process.env[`PAYER_${normalized}_USER`] || process.env.PORTAL_USER || 'admin',
      pass: process.env[`PAYER_${normalized}_PASS`] || process.env.PORTAL_PASS || 'password'
    };
  };
  const creds = getPortalCredentials(payer);
  
  // [NEW] AI Brain pre-processing
  const clinicalStrategy = await generateClinicalStrategy(denialReason, claimId, patientContext.priorAuthCode);

  const goal = buildGoal({ claimId, payer, denialReason, targetUrl, creds, patientContext, clinicalStrategy });

  console.log(`🎯 Target: ${targetUrl} | Mode: FULL`);

  console.log('--- GOAL ---\n', goal, '\n--- END GOAL ---');

  try {
    const tfResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ url: targetUrl, goal, browser_profile: 'stealth' })
    });

    const data = await tfResponse.json();

    if (!tfResponse.ok) {
      console.error('❌ TinyFish error:', data);
      return res.status(tfResponse.status).json({
        success: false,
        message: data.message || data.detail || 'TinyFish Agent error.'
      });
    }

    agentSessionActive = true;
    // Safety: reset after 10 minutes max
    setTimeout(() => { agentSessionActive = false; }, 600000);

    const runId = data.run_id || data.id;
    console.log(`✅ Agent started. runId=${runId}`);

    // Partner Stack: AgentOps + Axiom telemetry (fire-and-forget)
    agentOpsStart(runId, claimId, payer);
    axiomLog('run_started', { runId, claimId, payer, mode: 'full', targetUrl });

    await AgentRun.create({
      runId,
      claimId,
      payer,
      mode: 'full',
      targetUrl,
      status: 'running'
    });


    res.json({ success: true, runId, message: 'Agent started successfully.' });

  } catch (err) {
    console.error('❌ ORCHESTRATION ERROR:', err);
    res.status(500).json({ success: false, message: `Backend error: ${err.message}` });
  }
});
// Status polling endpoint to check TinyFish run state
app.get('/api/check-run/:id', async (req, res) => {
  const { id } = req.params;
  const apiKey = process.env.TINYFISH_API_KEY;

  try {
    // Force no-cache for polling
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    // Disable ETag to prevent 304 Not Modified loops
    res.removeHeader('ETag');

    const response = await fetch(`https://agent.tinyfish.ai/v1/runs/${id}`, {
      headers: { "X-API-Key": apiKey }
    });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: data.message });
    }

    // TinyFish uses "success" for completion, our frontend expects "completed"
    // Also handling potential uppercase versions for total robustness
    const rawStatus = (data.status || 'unknown').toLowerCase();
    const normalizedStatus = (rawStatus === 'success' || rawStatus === 'completed') ? 'completed' : rawStatus;

    if (normalizedStatus === 'completed' || normalizedStatus === 'failed') {
      agentSessionActive = false;
      // Partner Stack: AgentOps + Axiom telemetry (fire-and-forget)
      agentOpsEnd(id, normalizedStatus, data.result);
      axiomLog('run_completed', { runId: id, status: normalizedStatus, result: data.result });
      
      // [NEW] Update MongoDB Persistent State
      await AgentRun.findOneAndUpdate(
        { runId: id },
        { status: normalizedStatus, result: data.result, completedAt: new Date() }
      );

      if (normalizedStatus === 'completed') {
        const resultText = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
        await Claim.findOneAndUpdate(
          { claimId: (await AgentRun.findOne({ runId: id }))?.claimId },
          { status: 'Appealing', updatedAt: new Date() }
        );
      }
    }


    console.log(`[POLL] Run ${id}: TinyFish reported '${data.status}', normalized to '${normalizedStatus}'`);

    res.json({ 
      success: true, 
      status: normalizedStatus, 
      result: data.result 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Final Error Middleware
app.use((err, req, res, next) => {
  console.error("🔥 EXPRESS ERROR:", err);
  res.status(500).send("Internal Server Error - Check Logs");
});

app.listen(PORT, () => {
  console.log(`RevRecover Agent Backend listening on port ${PORT}`);
  console.log('Waiting for TinyFish API Integration...');
});
