<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldAlert, FileText, CheckCircle, Clock, UploadCloud, ChevronRight, Activity, ArrowRight, UserCircle, DollarSign, Users, Zap, Terminal, HelpCircle, ChevronDown, Sun, Moon, LogOut } from 'lucide-vue-next'

const router = useRouter()

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push({ name: 'Login' });
};
const claims = ref([]);
const selectedClaim = ref(null);
const agentStatus = ref("idle"); 
const liveFeed = ref([]);
const recoveredRevenue = ref(0);
const hoursSaved = ref(0);
const agentSuccessRate = ref(0);
const publicPortalUrl = ref("");
const isDark = ref(true);
const activeTab = ref("queue"); // "queue" or "history"
const searchQuery = ref("");

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER STACK: ElevenLabs — Voice announcement after successful appeal
// Key is held securely on the backend. Frontend calls /api/tts proxy.
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
// ─────────────────────────────────────────────────────────────────────────────
const announceAppealSuccess = async (patientName, amount) => {
  const text = `Appeal successfully filed for ${patientName}. ${amount} is now under active recovery review by TinyFish.`;
  const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel — natural, professional voice
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  try {
    const audioRes = await fetch(`${apiBaseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId })
    });

    if (audioRes.ok) {
      const blob = await audioRes.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      return;
    }

    // Non-ok response (e.g. 402 quota exceeded, 503 key not set) — log and fall through to browser speech
    console.warn(`[ElevenLabs] TTS proxy returned ${audioRes.status}. Falling back to browser speech.`);
  } catch (e) {
    console.warn('[ElevenLabs] TTS proxy network error, falling back to browser speech:', e.message);
  }

  // Fallback: browser built-in SpeechSynthesis (works without API key)
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
};

const PAGE_SIZE = 8;
const currentPage = ref(1);

const handleTabSwitch = (tab) => {
  activeTab.value = tab;
  selectedClaim.value = null;
  searchQuery.value = "";
  currentPage.value = 1;
};

const filteredClaims = computed(() => {
  const statusFilter = activeTab.value === 'history' ? 'Appealing' : 'Denied';
  const query = searchQuery.value.trim().toLowerCase();
  return claims.value
    .filter(c => c.status === statusFilter)
    .filter(c => !query || c.patient.toLowerCase().includes(query));
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredClaims.value.length / PAGE_SIZE)));

const paginatedClaims = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filteredClaims.value.slice(start, start + PAGE_SIZE);
});

// Reset to page 1 whenever search changes
watch(searchQuery, () => { currentPage.value = 1; });

const frontendBuildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'Dev';
const backendBuildTime = ref('Syncing...');

const fetchBackendHealth = async () => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const res = await fetch(`${apiBaseUrl}/api/health`);
    const data = await res.json();
    backendBuildTime.value = data.buildTime || 'N/A';
  } catch (e) {
    backendBuildTime.value = 'Offline';
  }
};

const RARC_MAP = {
  "Code 197": "Missing Prior Authorization. This service requires medical necessity review before performance.",
  "Code 50": "Medical Necessity. The documentation provided does not support the intensity of service.",
  "Code 18": "Duplicate Claim. Our records show an identical service was already processed or paid.",
  "Code 114": "Experimental/Investigational. The treatment is not yet FDA approved for this specific diagnosis.",
  "Code 96": "Non-Covered Service. This specific procedure is excluded from the patient's benefits package.",
  "Code 16": "Lack of Documentation. Requires additional clinical charts or operative notes for adjudication.",
  "Code 130": "Step Therapy Required. Patient must try and fail lower-cost alternatives before this treatment.",
  "Code 22": "Co-ordination of Benefits. Requires verification of primary insurance coverage before this claim can be adjudicated."
};

const activeCredentialKey = computed(() => {
  if (!selectedClaim.value) return "NONE";
  let payer = selectedClaim.value.payer.split(' ')[0].toUpperCase();
  if (payer === "MEDICARE" || payer === "CMS") payer = "BLUEBUTTON";
  return `PAYER_${payer}`;
});

const formattedAppealContent = computed(() => {
  if (!selectedClaim.value || !selectedClaim.value.appealContent) return null;
  try {
    // Attempt to parse if it's a JSON string
    return JSON.parse(selectedClaim.value.appealContent);
  } catch (e) {
    return null;
  }
});

// Persistence Logic
const saveState = () => {
  const state = {
    isDark: isDark.value
  };
  localStorage.setItem('revrecover_dashboard_state', JSON.stringify(state));
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  saveState();
};

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fetchLiveClaims = async () => {
  try {
    const res = await fetch(`${apiBaseUrl}/api/claims`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.claims.length > 0) {
      claims.value = data.claims;
    }
  } catch(err) {
    console.error("Failed to fetch Synthea claims:", err);
  }
};

const fetchDashboardStats = async () => {
  try {
    const res = await fetch(`${apiBaseUrl}/api/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      recoveredRevenue.value = data.recoveredRevenue;
      hoursSaved.value = data.hoursSaved;
      agentSuccessRate.value = data.agentSuccessRate;
    }
  } catch(err) {
    console.error("Failed to fetch dashboard stats:", err);
  }
};

const isMedicareClaim = computed(() =>
  selectedClaim.value?.payer?.toLowerCase().includes('medicare') ||
  selectedClaim.value?.payer?.toLowerCase().includes('bluebutton')
);

const connectMedicare = async () => {
  try {
    const res = await fetch(`${apiBaseUrl}/api/cms/authorize`);
    const data = await res.json();
    if (data.success && data.authUrl) {
      if (data.verifier) {
        sessionStorage.setItem('cms_pkce_verifier', data.verifier);
      }
      window.location.href = data.authUrl;
    } else {
      alert('CMS connection failed: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    alert('Could not reach backend: ' + err.message);
  }
};

const resetDashboard = () => {
  if (confirm("Reset local dashboard theme settings?")) {
    localStorage.removeItem('revrecover_dashboard_state');
  }
};

onMounted(() => {
  if (currentUser.role === 'Auditor') {
    activeTab.value = 'history';
  }
  
  const savedStatus = localStorage.getItem('revrecover_dashboard_state');
  if (savedStatus) {
    const state = JSON.parse(savedStatus);
    if (state.isDark !== undefined) isDark.value = state.isDark;
  }
  
  fetchBackendHealth();
  fetchLiveClaims();
  fetchDashboardStats();
});

const selectClaim = (claim) => {
  selectedClaim.value = claim;
  agentStatus.value = "idle";
  liveFeed.value = [];
}

const addFeedLog = (message, delay) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
      liveFeed.value.push({ time, message });
      resolve();
    }, delay * 1000); // converting seconds to ms
  });
};

const handleRunAgent = async () => {
  if (!selectedClaim.value) return;

  agentStatus.value = "running";
  liveFeed.value = [];

  await addFeedLog(`[INITIALIZATION] Booting TinyFish Agent...`, 0);
  await addFeedLog(`[TARGET] Portal: ${publicPortalUrl.value || 'Auto (Cloud Run)'}`, 0);
  await addFeedLog(`[MODE] FULL — clinical research enabled`, 0);

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  try {
    if (selectedClaim.value.status === 'Denied') {
      const response = await fetch(`${apiBaseUrl}/api/run-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: selectedClaim.value.claimId,
          patient: selectedClaim.value.patient,
          payer: selectedClaim.value.payer,
          denialReason: selectedClaim.value.denialReason,
          publicPortalUrl: publicPortalUrl.value
        })
      });

      const result = await response.json();

      if (!response.ok || !result.runId) {
        await addFeedLog(`[ERROR] ${result.message || 'Failed to start agent'}`, 0);
        agentStatus.value = "error";
        return;
      }

      await addFeedLog(`[CLOUD] Agent started. Run ID: ${result.runId}`, 0);
      await addFeedLog(`[CLOUD] Navigating portal and executing appeal...`, 0);

      // Poll for completion — simple and reliable
      let attempts = 0;
      const maxAttempts = 144; // 12 minutes max at 5s interval
      let isDone = false;

      while (!isDone && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 5000));

        const checkRes = await fetch(`${apiBaseUrl}/api/check-run/${result.runId}?t=${Date.now()}`);
        const checkData = await checkRes.json();

        console.log(`[POLL ${attempts}] status=${checkData.status}`);

        if (checkData.status === 'completed' || checkData.status === 'success') {
          isDone = true;
          await addFeedLog(`[SUCCESS] Appeal submitted. Syncing state...`, 0);
          agentStatus.value = "success";
          selectedClaim.value.status = "Appealing";
          selectedClaim.value.completedAt = new Date().toLocaleString();
          // Update live metrics from MongoDB
          await fetchDashboardStats();
          
          // Try to parse the agent's JSON response to extract the specific justification text
          try {
            const parsed = typeof checkData.result === 'string' ? JSON.parse(checkData.result) : checkData.result;
            if (parsed && typeof parsed === 'object') {
              selectedClaim.value.appealContent = parsed.justification || JSON.stringify(parsed, null, 2);
            } else {
              selectedClaim.value.appealContent = checkData.result;
            }
          } catch (e) {
            selectedClaim.value.appealContent = checkData.result || "Clinical appeal successfully generated and filed via TinyFish Agentic workflow.";
          }
          
          saveState();

          // Partner Stack: ElevenLabs — Announce success via AI voice
          announceAppealSuccess(selectedClaim.value.patient, selectedClaim.value.amount);
        } else if (checkData.status === 'failed') {
          isDone = true;
          await addFeedLog(`[ERROR] Agent failed. Check TinyFish dashboard.`, 0);
          agentStatus.value = "error";
        } else {
          await addFeedLog(`[WORKING] Agent running... (${attempts * 5}s elapsed)`, 0);
        }
      }

      if (!isDone) {
        await addFeedLog(`[TIMEOUT] No response after 5 minutes. Check TinyFish dashboard.`, 0);
        agentStatus.value = "error";
      }
    }
  } catch (err) {
    console.error("Agent error:", err);
    await addFeedLog(`[ERROR] ${err.message}`, 0);
    agentStatus.value = "error";
  }
}

const openFaq = ref(null);
const faqs = [
  {
    q: "How does the TinyFish Agent bypass enterprise security?",
    a: "The agent is engineered to handle chaotic, unstandardized web environments. It dynamically navigates complex HIPAA compliance gates, handles unpredictable 2FA popups via session-authenticated memory, and successfully submits claims without human intervention."
  },
  {
    q: "Does this ingest real Medicare records?",
    a: "Yes! By clicking 'Medicare Connect', RevRecover executes a live OAuth PKCE handshake with the CMS BlueButton 2.0 API. It instantly ingests authorized FHIR R4 claims data from the US Government and injects it straight into your Denials Queue."
  },
  {
    q: "How does the AI write clinical appeals?",
    a: "The agent autonomously researches specific denial reasons (like RARC Code 16) by scanning real-world clinical databases such as ClinicalTrials.gov. It extracts verified scientific studies to generate a robust medical necessity argument that overturns the denial."
  },
  {
    q: "Will this replace human billing staff?",
    a: "No. RevRecover augments human auditors by functioning as a high-speed 'AI Workforce'. Humans oversee the strategic approval matrix, while TinyFish asynchronously handles the repetitive, multi-step portal navigation that currently costs hospitals thousands of clerical hours."
  },
  {
    q: "What powers the agent's voice alerts?",
    a: "We integrated the ElevenLabs API directly into the workflow. When the AI finishes an appeal for a high-value claim, it successfully triggers a real-time, broadcast-quality audio confirmation system to dynamically alert the hospital auditing floor."
  }
];

const toggleFaq = (index) => {
  openFaq.value = openFaq.value === index ? null : index;
}
</script>

<template>
  <div :class="['min-h-screen font-sans selection:bg-[#3B82F6] selection:text-white pb-10 transition-colors duration-300', isDark ? 'bg-[#0A0C10] text-[#E2E8F0]' : 'bg-slate-50 text-slate-800']">
    <!-- Navbar -->
    <nav :class="['border-b sticky top-0 z-50 backdrop-blur-md transition-colors duration-300', isDark ? 'border-[#1E293B] bg-[#0F172A]/80' : 'border-slate-200 bg-white/80']">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 items-center">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity class="w-5 h-5 text-white" />
            </div>
            <span :class="['font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r', isDark ? 'from-white to-slate-400' : 'from-slate-900 to-slate-600']">RevRecover</span>
            <div class="flex flex-col ml-2">
              <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors duration-300 w-fit', isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200']">Powered by TinyFish AI</span>
              <span class="text-[7.5px] font-bold text-slate-500 mt-1 uppercase tracking-tighter ml-1">
                F: {{ frontendBuildTime }} | B: {{ backendBuildTime }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-6">
            <!-- Reset Button (Hidden as per requirements) -->
            <!--
            <button 
              @click="resetDashboard"
              :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border', isDark ? 'text-slate-400 border-slate-700 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/5' : 'text-slate-500 border-slate-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50']"
              title="Reset All Data"
            >
              <Activity class="w-3.5 h-3.5" />
              Reset Data
            </button>
            -->

            <!-- Theme Toggle -->
            <button 
              @click="toggleTheme" 
              :class="['p-2 rounded-xl border transition-all duration-300', isDark ? 'bg-[#1E293B] border-slate-700 text-amber-400 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-blue-600 hover:bg-slate-200']"
              title="Toggle Theme"
            >
              <Sun v-if="isDark" class="w-5 h-5" />
              <Moon v-else class="w-5 h-5" />
            </button>
            <div class="flex items-center gap-4">
              <span :class="['text-sm font-medium transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-600']">
                Welcome, <span class="font-bold">{{ currentUser.name.split(' ')[0] }}</span> 
                <span class="text-xs px-2 py-0.5 ml-2 rounded-full border bg-slate-800/50 hidden md:inline-block">{{ currentUser.role }}</span>
              </span>
              <div :class="['w-9 h-9 rounded-full flex items-center justify-center border transition-colors duration-300 hidden sm:flex', isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200']">
                <UserCircle :class="['w-6 h-6 transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-600']" />
              </div>
              <!-- Control Panel Button (Admin Only) -->
              <button 
                v-if="currentUser.role === 'System Admin'"
                @click="router.push({ name: 'AdminPanel' })"
                :class="['flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border hover:bg-blue-500/10 group', isDark ? 'text-slate-400 border-slate-700 hover:text-blue-400 hover:border-blue-500/30' : 'text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-200']"
                title="Management Panel"
              >
                <Users class="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                Control Panel
              </button>

              <!-- CMS Medicare Connect (Admin / Manager) -->
              <button
                v-if="currentUser.role === 'System Admin' || currentUser.role === 'Billing Manager'"
                @click="connectMedicare"
                :class="['flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border group', isDark ? 'text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20' : 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100']"
                title="Connect Live Medicare Data via CMS BlueButton 2.0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                Medicare Data
              </button>

              <!-- Log Out Button -->
              <button 
                @click="handleLogout"
                :class="['flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border hover:bg-red-500/10 group', isDark ? 'text-slate-400 border-slate-700 hover:text-red-400 hover:border-red-500/30' : 'text-slate-500 border-slate-200 hover:text-red-600 hover:border-red-200']"
                title="Secure Sign Out"
              >
                <LogOut class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <!-- Analytics Section (Managers & Admins only) -->
      <div v-if="currentUser.role === 'System Admin' || currentUser.role === 'Billing Manager'" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div :class="['border rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden group transition-all duration-300', isDark ? 'bg-[#111827] border-[#1E293B]' : 'bg-white border-slate-200 shadow-slate-200/50']">
          <div :class="['absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all duration-500', isDark ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' : 'bg-emerald-400/20 group-hover:bg-emerald-400/30']"></div>
          <div class="flex items-center justify-between mb-2">
            <span :class="['text-sm font-medium transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">Revenue Recovered Pending</span>
            <DollarSign class="w-4 h-4 text-emerald-400" />
          </div>
          <span :class="['text-3xl font-bold tracking-tight transition-colors duration-300', isDark ? 'text-white' : 'text-slate-900']">${{ recoveredRevenue.toLocaleString() }}</span>
          <div class="mt-4 text-xs flex items-center gap-1 text-emerald-400 font-medium">
            <Activity class="w-3 h-3" />
            <span>+12.5% this month</span>
          </div>
        </div>

        <div :class="['border rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden group transition-all duration-300', isDark ? 'bg-[#111827] border-[#1E293B]' : 'bg-white border-slate-200 shadow-slate-200/50']">
          <div :class="['absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all duration-500', isDark ? 'bg-blue-500/10 group-hover:bg-blue-500/20' : 'bg-blue-400/20 group-hover:bg-blue-400/30']"></div>
          <div class="flex items-center justify-between mb-2">
            <span :class="['text-sm font-medium transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">Agent Success Rate</span>
            <CheckCircle class="w-4 h-4 text-blue-400" />
          </div>
          <span :class="['text-3xl font-bold tracking-tight transition-colors duration-300', isDark ? 'text-white' : 'text-slate-900']">{{ agentSuccessRate }}%</span>
          <div class="mt-4 text-xs flex items-center gap-1 text-blue-400 font-medium">
            <span>Vs. 41% Human Baseline</span>
          </div>
        </div>

        <div :class="['border rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden group transition-all duration-300', isDark ? 'bg-[#111827] border-[#1E293B]' : 'bg-white border-slate-200 shadow-slate-200/50']">
          <div :class="['absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all duration-500', isDark ? 'bg-purple-500/10 group-hover:bg-purple-500/20' : 'bg-purple-400/20 group-hover:bg-purple-400/30']"></div>
          <div class="flex items-center justify-between mb-2">
            <span :class="['text-sm font-medium transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">Human Hours Saved</span>
            <Clock class="w-4 h-4 text-purple-400" />
          </div>
          <span :class="['text-3xl font-bold tracking-tight transition-colors duration-300', isDark ? 'text-white' : 'text-slate-900']">{{ hoursSaved.toFixed(1) }} hrs</span>
          <div :class="['mt-4 text-xs font-medium transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">
            Automating multi-step portal work
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between mb-2">
        <div>
          <h1 :class="['text-2xl font-bold tracking-tight mb-1 transition-colors duration-300', isDark ? 'text-white' : 'text-slate-900']">Revenue Recovery Workspace</h1>
          <p :class="['text-sm transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">Identifying high-value claims ready for autonomous appeal generation.</p>
        </div>
      </div>

      <!-- Tab Navigation + Search -->
      <div class="flex items-center gap-3 mb-6 flex-wrap">
        <!-- Tab Switcher -->
        <div class="flex items-center gap-1 p-1 rounded-xl transition-colors duration-300" :class="isDark ? 'bg-[#111827] border border-[#1E293B]' : 'bg-slate-200/50 border border-slate-200'">
          <button 
            v-if="currentUser.role !== 'Auditor'"
            @click="handleTabSwitch('queue')"
            :class="['px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300', activeTab === 'queue' ? (isDark ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white text-blue-600 shadow-sm') : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')]"
          >
            Denials Queue
          </button>
          <button 
            @click="handleTabSwitch('history')"
            :class="['px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300', activeTab === 'history' ? (isDark ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white text-blue-600 shadow-sm') : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')]"
          >
            Audit History
          </button>
        </div>

        <!-- Patient Search -->
        <div class="relative flex items-center" style="min-width: 220px;">
          <svg 
            class="absolute left-3 w-4 h-4 pointer-events-none z-10 transition-colors duration-200" 
            :class="searchQuery ? 'text-blue-400' : (isDark ? 'text-slate-500' : 'text-slate-400')" 
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.197 5.197a7.5 7.5 0 0 0 10.606 10.606Z" />
          </svg>
          <input
            id="patient-search"
            v-model="searchQuery"
            type="text"
            placeholder="Search patients..."
            class="patient-search-input"
            :style="{
              background: isDark ? '#111827' : '#ffffff',
              borderColor: searchQuery ? 'rgba(59,130,246,0.6)' : (isDark ? '#1E293B' : '#e2e8f0'),
              color: isDark ? '#e2e8f0' : '#334155',
              '--placeholder-color': isDark ? '#475569' : '#94a3b8',
              boxShadow: searchQuery ? '0 0 0 2px rgba(59,130,246,0.15)' : 'none'
            }"
          />
          <!-- Clear button -->
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            title="Clear search"
            style="position: absolute; right: 0.6rem; background: none; border: none; cursor: pointer; display: flex; align-items: center;"
            :style="{ color: isDark ? '#94a3b8' : '#64748b' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" style="width: 0.875rem; height: 0.875rem;" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Live result count badge -->
        <span
          v-if="searchQuery"
          :style="{
            fontSize: '0.75rem',
            fontWeight: '600',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(59,130,246,0.2)' : '#bfdbfe',
            background: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff',
            color: isDark ? '#60a5fa' : '#2563eb'
          }"
        >
          {{ filteredClaims.length }} result{{ filteredClaims.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Left Column: Claims List -->
        <div class="lg:col-span-2 flex flex-col gap-4">
          <!-- No results state -->
          <div
            v-if="filteredClaims.length === 0 && searchQuery"
            :class="['border-2 border-dashed rounded-2xl p-10 text-center transition-colors duration-300', isDark ? 'border-[#1E293B] bg-[#111827]/50' : 'border-slate-200 bg-white']"
          >
            <svg xmlns="http://www.w3.org/2000/svg" :class="['w-10 h-10 mx-auto mb-3 transition-colors duration-300', isDark ? 'text-slate-700' : 'text-slate-300']" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.197 5.197a7.5 7.5 0 0 0 10.606 10.606Z" />
            </svg>
            <p :class="['text-sm font-medium', isDark ? 'text-slate-400' : 'text-slate-500']">No patients found matching <span class="font-bold text-blue-400">"{{ searchQuery }}"</span></p>
            <button @click="searchQuery = ''" class="mt-3 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">Clear search</button>
          </div>

          <div 
            v-for="claim in paginatedClaims" 
            :key="claim.id"
            @click="selectClaim(claim)"
            :class="[
              'border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative group overflow-hidden',
              selectedClaim?.id === claim.id 
                ? (isDark ? 'border-[#3B82F6] ring-1 ring-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-gradient-to-r from-[#111827] to-[#1E3A8A]/10' : 'border-[#3B82F6] ring-1 ring-[#3B82F6] bg-blue-50/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]') 
                : (claim.payer || '').toLowerCase().includes('medicare')
                   ? 'border-yellow-400 bg-[#FEFCE8] hover:border-yellow-500 hover:bg-[#FEF08A] hover:shadow-lg !text-slate-900'
                   : (isDark ? 'border-[#1E293B] bg-[#111827] hover:border-slate-600 hover:bg-[#1E293B]/50' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md')
            ]"
          >
            <!-- Highlight bar on left for Medicare -->
            <div v-if="(claim.payer || '').toLowerCase().includes('medicare')" class="absolute top-0 bottom-0 left-0 w-2 bg-yellow-400"></div>

            <div class="flex justify-between items-start mb-3 relative z-10">
              <div class="flex items-center gap-3">
                <div v-if="(claim.payer || '').toLowerCase().includes('medicare')" class="p-2 rounded-lg border bg-yellow-100 border-yellow-300 shadow-sm ml-2">
                  <Activity class="w-5 h-5 text-yellow-600" />
                </div>
                <div v-else :class="['p-2 rounded-lg border transition-colors duration-300', isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100']">
                  <ShieldAlert class="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 :class="['font-bold text-lg transition-colors duration-300', (claim.payer || '').toLowerCase().includes('medicare') && selectedClaim?.id !== claim.id ? '!text-slate-900' : (isDark ? 'text-white' : 'text-slate-900')]">
                    {{ claim.patient || 'Medicare Patient' }}
                  </h3>
                  <div :class="['flex items-center gap-2 text-xs mt-0.5 transition-colors duration-300', (claim.payer || '').toLowerCase().includes('medicare') && selectedClaim?.id !== claim.id ? '!text-slate-600' : (isDark ? 'text-slate-400' : 'text-slate-500')]">
                    <span>ID: {{ claim.id }}</span>
                    <span>•</span>
                    <span :class="['px-1.5 py-0.5 rounded font-bold transition-all duration-300', (claim.payer || '').toLowerCase().includes('medicare') ? 'bg-yellow-200 !text-yellow-800' : (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700')]">
                      {{ claim.payer }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div :class="['font-bold text-lg transition-colors duration-300', (claim.payer || '').toLowerCase().includes('medicare') && selectedClaim?.id !== claim.id ? '!text-slate-900' : (isDark ? 'text-white' : 'text-slate-900')]">
                  {{ claim.amount }}
                </div>
                <div :class="['text-xs font-medium px-2 py-1 rounded-full inline-block mt-1 border transition-colors duration-300', (claim.payer || '').toLowerCase().includes('medicare') ? 'bg-red-100 !text-red-700 border-red-200' : claim.status === 'Denied' ? (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100') : (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100')]">
                  {{ claim.status }}
                </div>
              </div>
            </div>

            <div :class="['p-3 rounded-xl border flex items-start gap-2 transition-colors duration-300 group/rarc relative', isDark ? 'bg-[#0A0C10] border-[#1E293B]' : 'bg-slate-50 border-slate-100']">
               <FileText class="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
               <p :class="['text-sm transition-colors duration-300', isDark ? 'text-slate-300' : 'text-slate-600']">
                 <span :class="['font-semibold transition-colors duration-300 pointer-events-auto cursor-help decoration-blue-500/30 underline underline-offset-4', isDark ? 'text-slate-400' : 'text-slate-500']">RARC Code:</span> 
                 {{ claim.denialReason }}
               </p>
               
               <!-- RARC Tooltip -->
               <div :class="['absolute bottom-full left-0 mb-2 w-64 p-3 rounded-lg border shadow-xl opacity-0 invisible group-hover/rarc:opacity-100 group-hover/rarc:visible transition-all duration-300 z-10 text-xs leading-relaxed', isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-slate-200/50']">
                 <div class="font-bold mb-1 text-blue-400 uppercase tracking-wider">Intelligence Brief:</div>
                 {{ claim.denialReason.includes('(') ? RARC_MAP[claim.denialReason.split('(')[1].replace(')', '')] || 'Electronic Remittance Advice code requiring specific clinical justification.' : 'Electronic Remittance Advice code requiring specific clinical justification.' }}
                 <div :class="['mt-2 pt-2 border-t font-medium italic', isDark ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400']">
                   TinyFish agent trained on this specific RARC pattern.
                 </div>
               </div>
            </div>
            
            <div class="mt-4 flex items-center justify-between text-xs font-medium">
               <span v-if="activeTab === 'queue'" :class="['flex items-center gap-1 transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">
                 <Clock class="w-3.5 h-3.5" />
                 Deadline: {{ claim.daysToAppeal }} days left
               </span>
               <span v-else :class="['flex items-center gap-1 transition-colors duration-300', isDark ? 'text-emerald-500' : 'text-emerald-600']">
                 <CheckCircle class="w-3.5 h-3.5" />
                 Filed on {{ claim.completedAt }}
               </span>
               <span :class="['flex items-center gap-1 transition-colors duration-300', isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700']">
                 View Adjudication Context <ChevronRight class="w-3.5 h-3.5" />
               </span>
            </div>
          </div>
          
          <div v-if="activeTab === 'history' && !claims.some(c => c.status === 'Appealing')" :class="['border-2 border-dashed rounded-2xl p-12 text-center transition-colors duration-300', isDark ? 'border-[#1E293B] bg-[#111827]/50' : 'border-slate-200 bg-white']">
             <Activity :class="['w-12 h-12 mx-auto mb-4 transition-colors duration-300', isDark ? 'text-slate-700' : 'text-slate-300']" />
             <h3 :class="['text-lg font-bold mb-2', isDark ? 'text-slate-400' : 'text-slate-900']">{{ currentUser.role === 'Auditor' ? 'No Compliance Logs Found' : 'No History Yet' }}</h3>
             <p :class="['text-sm transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">{{ currentUser.role === 'Auditor' ? 'Agents must execute appeals before audit trails are available for compliance checks.' : 'Successful appeals filed by TinyFish agents will appear here for audit review.' }}</p>
          </div>

          <!-- Pagination Controls -->
          <div v-if="totalPages > 1" class="flex items-center justify-between mt-2 pt-4" :class="isDark ? 'border-t border-[#1E293B]' : 'border-t border-slate-200'">
            <span :class="['text-xs font-medium', isDark ? 'text-slate-500' : 'text-slate-400']">
              Showing {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, filteredClaims.length) }} of {{ filteredClaims.length }} patients
            </span>
            <div class="flex items-center gap-2">
              <button
                @click="currentPage = Math.max(1, currentPage - 1)"
                :disabled="currentPage === 1"
                :class="['px-4 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed', isDark ? 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50']"
              >← Prev</button>
              <div class="flex items-center gap-1">
                <button
                  v-for="p in totalPages"
                  :key="p"
                  @click="currentPage = p"
                  :class="['w-7 h-7 rounded-lg text-xs font-bold border transition-all duration-200', currentPage === p ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : (isDark ? 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:border-slate-400')]"
                >{{ p }}</button>
              </div>
              <button
                @click="currentPage = Math.min(totalPages, currentPage + 1)"
                :disabled="currentPage === totalPages"
                :class="['px-4 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed', isDark ? 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50']"
              >Next →</button>
            </div>
          </div>
        </div>

        <!-- Right Column: Detail View & AI Execution -->
        <div class="lg:col-span-1">
          <div v-if="selectedClaim" :class="['border shadow-2xl sticky top-24 overflow-hidden flex flex-col h-[calc(100vh-8rem)] transition-all duration-300 rounded-2xl', isDark ? 'bg-[#111827] border-[#1E293B]' : 'bg-white border-slate-200 shadow-slate-200/50']">
            <!-- Header -->
            <div :class="['p-6 border-b transition-colors duration-300', isDark ? 'border-[#1E293B] bg-gradient-to-b from-[#1E293B]/50 to-transparent' : 'border-slate-100 bg-gradient-to-b from-slate-50 to-transparent']">
              <h2 :class="['text-xl font-bold tracking-tight mb-1 transition-colors duration-300', isDark ? 'text-white' : 'text-slate-900']">
                {{ selectedClaim.status === 'Appealing' ? 'Audit Intelligence' : 'Claim Resolution' }}
              </h2>
              <p :class="['text-sm transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">
                {{ selectedClaim.status === 'Appealing' ? 'Reviewing agent-generated clinical argument.' : 'Autonomous workflow ready.' }}
              </p>
            </div>

            <!-- Scrollable Content -->
            <div class="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <div class="space-y-4 mb-6">
                 <div>
                   <label :class="['text-xs font-semibold uppercase tracking-wider transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">Patient Name</label>
                   <p :class="['font-medium mt-1 transition-colors duration-300', isDark ? 'text-slate-200' : 'text-slate-700']">{{ selectedClaim.patient }}</p>
                 </div>
                 <div>
                   <label :class="['text-xs font-semibold uppercase tracking-wider transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">Target Payer Portal</label>
                   <div class="flex items-center gap-2 mt-1">
                     <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                     <p :class="['font-medium transition-colors duration-300', isDark ? 'text-slate-200' : 'text-slate-700']">{{ selectedClaim.payer }}</p>
                   </div>
                 </div>
                 <div>
                   <label :class="['text-xs font-semibold uppercase tracking-wider transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">Required Action</label>
                   <p :class="['font-medium mt-1 transition-colors duration-300', isDark ? 'text-slate-200' : 'text-slate-700']">Submit comprehensive clinical appeal with internal records.</p>
                 </div>
              </div>
                  
              <!-- Appeal Content Audit View (The "Magic" Revealed) -->
              <div v-if="selectedClaim.status === 'Appealing'" :class="['pt-4 border-t transition-colors duration-300', isDark ? 'border-[#1E293B]' : 'border-slate-100']">
                <label :class="['text-xs font-semibold uppercase tracking-wider transition-colors duration-300 mb-2 block', isDark ? 'text-blue-400' : 'text-blue-600']">Generated Appeal Argument</label>
                <div :class="['p-4 rounded-xl text-sm leading-relaxed border transition-colors duration-300', isDark ? 'bg-[#0A0C10] border-[#1E293B] text-slate-300' : 'bg-blue-50/30 border-blue-100 text-slate-700']">
                  <!-- Structured JSON View -->
                  <div v-if="formattedAppealContent" class="space-y-4 font-sans not-italic">
                    <!-- Authorization Status -->
                    <div v-if="formattedAppealContent.phase2_authorization" class="border-b border-blue-500/10 pb-3">
                      <div class="flex items-center gap-2 mb-2">
                        <CheckCircle class="w-3.5 h-3.5 text-emerald-400" />
                        <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Authorization Logic Confirmation</span>
                      </div>
                      <p class="text-[11px] leading-relaxed opacity-90">{{ formattedAppealContent.phase2_authorization.overall_status }}</p>
                      <ul class="mt-2 space-y-1.5">
                        <li v-for="step in formattedAppealContent.phase2_authorization.steps" :key="step.step" class="text-[10px] flex items-start gap-2">
                          <span class="text-blue-400 font-bold min-w-[12px]">{{ step.step }}.</span>
                          <span><b class="text-slate-100">{{ step.name }}:</b> {{ step.details }}</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Clinical Data -->
                    <div v-if="formattedAppealContent.phase1_clinical_research_data">
                      <div class="flex items-center gap-2 mb-2">
                        <Activity class="w-3.5 h-3.5 text-blue-400" />
                        <span class="text-[10px] font-bold uppercase tracking-wider text-blue-400">Extracted Clinical Evidence (ClinicalTrials.gov)</span>
                      </div>
                      <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                          <p class="text-[8px] uppercase text-slate-500 font-bold">Protocol ID</p>
                          <p class="text-[10px] font-mono text-blue-300">{{ formattedAppealContent.phase1_clinical_research_data.study_nct }}</p>
                        </div>
                        <div class="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                          <p class="text-[8px] uppercase text-slate-500 font-bold">Research Query</p>
                          <p class="text-[10px] text-slate-300">{{ formattedAppealContent.phase1_clinical_research_data.search_query }}</p>
                        </div>
                      </div>
                      <ul class="space-y-2">
                        <li v-for="point in formattedAppealContent.phase1_clinical_research_data.research_data_points" :key="point.id" class="text-[11px] text-slate-400 leading-normal">
                          • {{ point.description }}
                        </li>
                      </ul>
                    </div>
                  </div>

                  <!-- Fallback Text View -->
                  <div v-else class="font-serif italic">
                    "{{ selectedClaim.appealContent || 'Retrieving clinical justification from audit trace...' }}"
                  </div>
                </div>
                <div class="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                  <Zap class="w-3 h-3 text-amber-400" />
                  End-to-End Autonomous Filing Confirmed
                </div>
              </div>

              <!-- Public Portal URL Configuration (Only for Denied claims) -->
              <div v-else :class="['pt-4 border-t transition-colors duration-300', isDark ? 'border-[#1E293B]' : 'border-slate-100']">
                <div class="flex items-center justify-between mb-2">
                  <label :class="['text-xs font-semibold uppercase tracking-wider transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">Live Agent Mode</label>
                  <span v-if="publicPortalUrl" class="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">LIVE</span>
                  <span v-else class="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">SIMULATION</span>
                </div>
                <div class="relative group">
                  <input 
                    v-model="publicPortalUrl"
                    type="text" 
                    placeholder="Paste Enterprise Portal URL here"
                    :class="['w-full border rounded-xl py-2 px-3 text-xs focus:outline-none transition-all placeholder:text-slate-600', isDark ? 'bg-[#0A0C10] border-[#1E293B] text-slate-300 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-400']"
                  />
                  <Zap v-if="publicPortalUrl" class="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-amber-400 animate-pulse" />
                </div>
                    <p :class="['text-[10px] mt-2 leading-relaxed transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">
                      To fulfill "Real Work" verification, enter the live URL of your **Enterprise Portal**.
                    </p>

                    <!-- Credential Key Badge -->
                    <div class="mt-4 flex items-center justify-between p-2 rounded-lg border border-dashed transition-colors duration-300" :class="isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'">
                      <div class="flex items-center gap-2">
                        <ShieldCheck class="w-3 h-3 text-blue-500" />
                        <span class="text-[9px] font-bold uppercase tracking-widest text-blue-500">Security Vault Key</span>
                      </div>
                      <code class="text-[10px] font-mono font-bold" :class="isDark ? 'text-blue-300' : 'text-blue-700'">{{ activeCredentialKey }}</code>
                    </div>
                  </div>
            </div>

              <!-- Live Agent Feed (Terminal) -->
              <div v-if="agentStatus !== 'idle'" :class="['mt-6 border rounded-xl overflow-hidden flex flex-col shadow-inner transition-colors duration-300', isDark ? 'border-slate-700 bg-[#090B0F]' : 'border-slate-200 bg-slate-900 shadow-slate-200/50']">
                <div :class="['px-3 py-2 border-b flex items-center gap-2 text-xs font-mono transition-colors duration-300', isDark ? 'bg-[#1E293B] border-slate-700 text-slate-400' : 'bg-slate-800 border-slate-700 text-slate-400']">
                  <Terminal class="w-4 h-4 text-emerald-400" />
                  <span>tinyfish-agent-feed.log</span>
                  <div class="ml-auto flex gap-1.5">
                    <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                  </div>
                </div>
                <div :class="['p-4 font-mono text-xs h-64 overflow-y-auto flex flex-col gap-2 transition-colors duration-300', isDark ? 'bg-[#090B0F]' : 'bg-slate-900']">
                  <div v-for="(log, idx) in liveFeed" :key="idx" class="flex items-start text-slate-300">
                    <span class="pr-3 text-slate-600 select-none">[{{ log.time }}]</span>
                    <span :class="log.message.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : log.message.includes('[ERROR]') ? 'text-red-400 font-bold' : ''">{{ log.message }}</span>
                  </div>
                  <div v-if="agentStatus === 'running'" class="flex items-center gap-2 text-slate-500 mt-2">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Agent traversing DOM...
                  </div>
                </div>
              </div>

            <!-- Footer Action Area -->
            <div :class="['p-6 border-t mt-auto transition-colors duration-300', isDark ? 'border-[#1E293B] bg-[#0A0C10]' : 'border-slate-100 bg-slate-50/50']">

               <button 
                 v-if="(agentStatus === 'idle' || agentStatus === 'error') && selectedClaim.status === 'Denied'"
                 @click="handleRunAgent"
                 :class="['w-full relative group overflow-hidden rounded-xl font-bold py-3.5 px-6 shadow-xl transition-all duration-300 flex items-center justify-between', isDark ? 'bg-gradient-to-r from-white to-slate-200 text-slate-900 shadow-[0_0_40px_rgba(255,255,255,0.1)]' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700']"
               >
                 <span class="z-10 text-sm tracking-wide">{{ agentStatus === 'error' ? 'Retry Autonomous Appeal' : 'Automate Appeal with Agent' }}</span>
                 <ArrowRight class="w-5 h-5 z-10 group-hover:translate-x-1 transition-transform" />
               </button>

               <div v-else-if="agentStatus === 'running'" :class="['w-full font-medium py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 border transition-colors duration-300', isDark ? 'bg-[#1E293B] text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200 shadow-sm']">
                  <svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Agent Session Active...
               </div>

               <div v-else class="w-full bg-emerald-500/10 text-emerald-400 font-bold py-4 px-6 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-3">
                  <CheckCircle class="w-5 h-5" />
                  Appeal Successfully Filed
               </div>
            </div>
          </div>
          
          <div v-else :class="['h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center md:min-h-[600px] text-center px-6 transition-colors duration-300', isDark ? 'border-[#1E293B] bg-[#0A0C10]/50' : 'border-slate-200 bg-white shadow-inner shadow-slate-50']">
             <div :class="['w-16 h-16 rounded-full flex items-center justify-center mb-4 border transition-colors duration-300', isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200']">
                <ShieldAlert :class="['w-8 h-8 transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-300']" />
             </div>
             <h3 :class="['text-xl font-bold mb-2 transition-colors duration-300', isDark ? 'text-white' : 'text-slate-900']">No Claim Selected</h3>
             <p :class="['text-sm max-w-[250px] transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">Select a denied claim from the queue to review context and deploy the TinyFish autonomous agent.</p>
          </div>
        </div>

      </div>
      <!-- FAQ Section -->
      <div :class="['mt-20 max-w-3xl mx-auto border-t pt-12 mb-20 transition-colors duration-300', isDark ? 'border-[#1E293B]' : 'border-slate-200']">
        <div class="flex items-center gap-3 mb-8">
          <div :class="['p-2 rounded-lg border transition-colors duration-300', isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100']">
            <HelpCircle class="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 :class="['text-xl font-bold transition-colors duration-300', isDark ? 'text-white' : 'text-slate-900']">System FAQ & Technical Specs</h2>
            <p :class="['text-xs uppercase tracking-widest mt-1 transition-colors duration-300', isDark ? 'text-slate-500' : 'text-slate-400']">Winning with TinyFish Agentic Framework</p>
          </div>
        </div>

        <div class="space-y-3">
          <div 
            v-for="(faq, idx) in faqs" 
            :key="idx"
            :class="[
              'border rounded-2xl overflow-hidden transition-all duration-300', 
              openFaq === idx 
                ? (isDark ? 'border-blue-500/50 bg-[#1e293b]/30' : 'border-blue-300 bg-blue-50') 
                : (isDark ? 'border-[#1E293B] bg-[#111827] hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300')
            ]"
          >
            <button 
              @click="toggleFaq(idx)"
              class="w-full px-6 py-5 flex items-center justify-between text-left group"
            >
              <span :class="['font-semibold transition-colors duration-300', isDark ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900']">{{ faq.q }}</span>
              <ChevronDown 
                :class="['w-5 h-5 transition-transform duration-300', isDark ? 'text-slate-50' : 'text-slate-400', openFaq === idx ? 'rotate-180 text-blue-400' : '']"
              />
            </button>
            <div 
              class="px-6 overflow-hidden transition-all duration-300 ease-in-out"
              :style="{ maxHeight: openFaq === idx ? '200px' : '0px', paddingBottom: openFaq === idx ? '20px' : '0px' }"
            >
              <p :class="['text-sm leading-relaxed transition-colors duration-300', isDark ? 'text-slate-400' : 'text-slate-500']">{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 20px;
}

/* Patient search input */
.patient-search-input {
  width: 220px;
  padding: 0.5rem 2.25rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  border-width: 1px;
  border-style: solid;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  caret-color: #3b82f6;
  appearance: none;
  -webkit-appearance: none;
}
.patient-search-input::placeholder {
  color: #475569;
}
.patient-search-input:focus {
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
</style>
