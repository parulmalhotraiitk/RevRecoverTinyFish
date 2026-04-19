<script setup>
import { ref, onMounted } from 'vue'
import { 
  FileWarning, 
  ChevronRight, 
  LogOut, 
  ArrowLeft, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Search, 
  Filter, 
  Database,
  User,
  Activity,
  Calendar,
  CreditCard,
  Lock,
  ArrowRight,
  Info
} from 'lucide-vue-next'

const isLoggedIn = ref(false);
const currentScreen = ref("login"); // login, dashboard, details, appeal, success
const selectedClaimId = ref(null);
const currentClaim = ref(null);

const showHipaaModal = ref(true);
const showDenialDetails = ref(false);

// Mock Login Credentials
const username = ref("");
const password = ref("");
const loginError = ref(false);
const isLoggingIn = ref(false);

// API Configuration
const API_BASE = "http://localhost:3001";

// Standard Demos: admin / password
const handleLogin = (e) => {
  e.preventDefault();
  isLoggingIn.value = true;
  if (username.value.length > 0 && password.value.length > 0) {
    isLoggedIn.value = true;
    currentScreen.value = "dashboard";
    fetchClaims();
  } else {
    loginError.value = true;
  }
  isLoggingIn.value = false;
}

// Appeal Form State
const appealReason = ref("");
const additionalComments = ref("");
const isSubmitting = ref(false);
const runId = ref(null);
const agentStatus = ref("");

const handleAppealSubmit = async (e) => {
  e.preventDefault();
  if (!currentClaim.value) return;

  isSubmitting.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/run-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimId: currentClaim.value.claimId,
        payer: currentClaim.value.payer,
        denialReason: currentClaim.value.denialReason || appealReason.value,
        turbo: true // Default to turbo for speed in demo
      })
    });
    const data = await res.json();
    if (data.success) {
      runId.value = data.runId;
      currentScreen.value = "success";
      pollAgentStatus();
    }
  } catch (err) {
    console.error("Agent Trigger Error:", err);
  } finally {
    isSubmitting.value = false;
  }
}

const pollAgentStatus = async () => {
  if (!runId.value) return;
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/check-run/${runId.value}`);
      const data = await res.json();
      agentStatus.value = data.status;
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
        fetchClaims(); // Refresh dashboard
      }
    } catch (err) {
      console.error("Polling Error:", err);
      clearInterval(interval);
    }
  }, 3000);
}

const currentPage = ref(1);
const claimsPerPage = 5;
const allClaims = ref([]);
const isLoading = ref(false);

async function fetchClaims() {
  isLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/portal-claims`);
    const data = await res.json();
    allClaims.value = data.claims;
  } catch (err) {
    console.error("Fetch Claims Error:", err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  if (isLoggedIn.value) fetchClaims();
});

const selectClaim = (claim) => {
  currentClaim.value = claim;
  selectedClaimId.value = claim.claimId;
  currentScreen.value = 'details';
}

const paginatedClaims = () => {
  const start = (currentPage.value - 1) * claimsPerPage;
  return allClaims.value.slice(start, start + claimsPerPage);
};

</script>

<template>
  <div class="min-h-screen font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative">
    <!-- Noise Grain Texture overlay -->
    <div class="noise-overlay"></div>

    <!-- Premium Navigation -->
    <nav class="sticky top-0 z-50 px-6 py-4">
      <div class="max-w-7xl mx-auto">
        <div class="glass-card px-6 py-3 flex justify-between items-center bg-white/40 shadow-2xl">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Database :size="20" />
            </div>
            <div>
              <h1 class="text-sm font-black uppercase tracking-[0.15em] text-slate-900">AetnaCare Provider</h1>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Enterprise Platinum 6.0</p>
              </div>
            </div>
          </div>
          
          <div v-if="isLoggedIn" class="flex items-center gap-6">
            <div class="hidden md:flex items-center gap-3 px-4 py-2 border-r border-slate-100">
              <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <User :size="16" />
              </div>
              <div class="text-left">
                <p class="text-[10px] font-black text-slate-900 uppercase">Admin_009</p>
                <p class="text-[9px] text-slate-400 font-bold uppercase">NPI: 1029384756</p>
              </div>
            </div>
            <button @click="isLoggedIn = false; currentScreen = 'login'; showHipaaModal = true" class="group flex items-center gap-2 text-slate-400 hover:text-red-500 transition-all font-bold text-[10px] uppercase tracking-widest">
              <LogOut :size="14" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-6 pb-20 pt-4">
      
      <!-- SCREEN: LOGIN -->
      <div v-if="currentScreen === 'login'" class="max-w-lg mx-auto mt-20 perspective-1000">
        <div class="premium-card animate-in fade-in zoom-in-95 duration-700 relative overflow-hidden">
          <!-- Background Glow -->
          <div class="absolute -top-24 -right-24 w-48 h-48 bg-blue-100/30 rounded-full blur-3xl"></div>
          
          <div class="text-center mb-10 relative">
             <div class="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-slate-50 text-blue-600 mb-6 border border-slate-100 shadow-inner">
                <Lock :size="32" />
             </div>
             <h2 class="text-3xl font-black text-slate-900 tracking-tight">Secure Vault Access</h2>
             <p class="text-sm text-slate-400 font-medium mt-2 uppercase tracking-widest text-[10px] font-black">Medical Review Gateway</p>
          </div>

          <form @submit="handleLogin" class="space-y-6 relative">
            <div v-if="loginError" class="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3 animate-bounce">
              <div class="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <FileWarning :size="14" />
              </div>
              Authorization Failed. Check credentials.
            </div>
            
            <div class="space-y-2">
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Identity Identifier (NPI)</label>
              <div class="relative group mt-1">
                <input id="username" v-model="username" type="text" class="legacy-input input-with-icon" placeholder="e.g. admin" />
                <User class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors pointer-events-none" :size="18" />
              </div>
            </div>
            
            <div class="space-y-2">
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Secure Passkey</label>
              <div class="relative group mt-1">
                <input id="password" v-model="password" type="password" class="legacy-input input-with-icon" placeholder="e.g. password" />
                <Lock class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors pointer-events-none" :size="18" />
              </div>
            </div>

            <div class="pt-2 px-2">
              <div class="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
                <Info :size="12" class="text-blue-500" />
                Demo Credentials: <span class="text-slate-900 font-black px-1">admin</span> / <span class="text-slate-900 font-black px-1">password</span>
              </div>
            </div>

            <div class="pt-6">
              <button id="login-btn" type="submit" :disabled="isLoggingIn" class="legacy-btn w-full py-4 text-lg shadow-blue-200 disabled:opacity-50 disabled:translate-y-0 relative overflow-hidden group">
                <div v-if="isLoggingIn" class="absolute inset-0 bg-blue-600 flex items-center justify-center gap-3">
                  <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span class="italic tracking-widest uppercase font-black text-[10px]">Validating...</span>
                </div>
                <span v-else class="flex items-center justify-center gap-2">
                  Initiate Secure Session <ArrowRight :size="18" class="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>
            
            <div class="flex items-center justify-center gap-3 pt-6 opacity-30 grayscale filter invert">
              <span class="text-[8px] font-black uppercase tracking-[0.4em] text-slate-900 border border-slate-900 px-2 py-1 rounded">FIPS-140-2</span>
              <div class="h-4 w-px bg-slate-400"></div>
              <span class="text-[8px] font-black uppercase tracking-[0.2em] text-slate-900">NIST Standard Compliance</span>
            </div>
          </form>
        </div>
      </div>

      <!-- SCREEN: DASHBOARD -->
      <div v-if="currentScreen === 'dashboard'" class="animate-in fade-in duration-700">
        
        <!-- HIPAA Modal -->
        <div v-if="showHipaaModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-all duration-700"></div>
          <div class="bg-white max-w-xl w-full rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.25)] relative overflow-hidden animate-in zoom-in-95 duration-500">
             <div class="h-2 w-full bg-gradient-to-r from-blue-600 via-emerald-400 to-blue-600 animate-gradient-x"></div>
             <div class="p-12">
               <div class="flex items-center gap-6 mb-8 text-blue-600">
                 <div class="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center shadow-inner ring-1 ring-blue-100">
                   <ShieldCheck :size="32" />
                 </div>
                 <div>
                   <h2 class="text-2xl font-black text-slate-900 uppercase tracking-tighter">Legal Attestation</h2>
                   <p class="text-[9px] font-black text-blue-600/60 uppercase tracking-[0.2em]">Medical Data Privacy Protocol</p>
                 </div>
               </div>
               <div class="space-y-6 text-sm text-slate-500 leading-relaxed mb-10 font-medium">
                 <p>This system contains <strong class="text-slate-900 underline decoration-blue-600/30">Protected Health Information (PHI)</strong> as defined by HIPAA Title II.</p>
                 <div class="p-6 bg-slate-50/80 rounded-[1.5rem] border border-slate-100 text-[11px] font-bold italic text-slate-400 flex gap-4 leading-normal">
                   <div class="shrink-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full"></div>
                   "Accessing this infrastructure constitutes explicit agreement to federal privacy statutes. All activity is logged and auditable for compliance review."
                 </div>
                 <p class="font-black text-slate-900 uppercase tracking-tight text-[11px] bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl border border-emerald-100">Do you affirm your authorization to access this PHI?</p>
               </div>
               <button id="agree-hipaa" @click="showHipaaModal = false" class="legacy-btn w-full py-5 text-xl tracking-tight rounded-2xl shadow-emerald-100">
                 Authorized Affirmation
               </button>
             </div>
          </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div class="animate-in slide-in-from-left-4 duration-700">
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-white/40 backdrop-blur-sm text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200 mb-3 shadow-sm">
              <Activity :size="10" /> Global Adjudication Engine
            </div>
            <h2 class="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1">Intelligence <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Command</span></h2>
            <p class="text-slate-400 font-bold text-base uppercase tracking-widest flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span> Centralized Claims Lifecycle
            </p>
          </div>
        </div>
        
        <!-- Premium Cards Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div class="glass-card p-8 flex items-center gap-8 group hover-lift">
            <div class="w-16 h-16 rounded-[1.5rem] bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
              <Calendar :size="28" />
            </div>
            <div>
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Fiscal Segment</p>
              <p class="text-2xl font-black text-slate-900 tracking-tighter">Q1-2026 Live</p>
            </div>
          </div>
          <div class="glass-card p-8 flex items-center gap-8 group hover-lift">
            <div class="w-16 h-16 rounded-[1.5rem] bg-red-50 flex items-center justify-center text-red-500 shadow-inner group-hover:bg-red-500 group-hover:text-white transition-all duration-500">
              <FileWarning :size="28" />
            </div>
            <div>
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">High Velocity</p>
              <p class="text-2xl font-black text-slate-900 tracking-tighter">12 Critical</p>
            </div>
          </div>
          <div class="glass-card p-8 flex items-center gap-8 group hover-lift">
            <div class="w-16 h-16 rounded-[1.5rem] bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
              <CreditCard :size="28" />
            </div>
            <div>
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Claim Intake</p>
              <p class="text-2xl font-black text-slate-900 tracking-tighter">$284.5K</p>
            </div>
          </div>
        </div>

        <!-- Premium Filter Workspace -->
        <div class="premium-card !p-8 mb-12 relative overflow-hidden group">
          <div class="absolute inset-0 bg-blue-50/10 pointer-events-none transition-all group-hover:bg-blue-50/20 duration-500"></div>
          <div class="flex flex-col lg:flex-row gap-10 items-end relative z-10">
            <div class="flex-1 w-full space-y-3">
               <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Disposition Protocol</label>
               <div class="relative group/select">
                 <select class="legacy-input appearance-none pr-14 font-black text-slate-800 text-sm py-4 border-slate-100 bg-white/80 shadow-inner">
                   <option>Intake: All Statuses</option>
                   <option>Intake: Verified Paid</option>
                   <option selected>Intake: Final Denials</option>
                   <option>Intake: Adjudication Delay</option>
                 </select>
                 <Filter class="absolute right-5 top-4.5 text-slate-300 group-focus-within/select:text-blue-500 transition-colors" :size="20" />
               </div>
            </div>
            <div class="flex-1 w-full space-y-3">
               <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Service Period</label>
               <div class="relative group/date">
                 <input type="date" class="legacy-input font-black text-slate-800 text-sm py-4 border-slate-100 bg-white/80 shadow-inner" value="2026-01-01" />
               </div>
            </div>
            <div class="w-full lg:w-auto">
              <button class="legacy-btn w-full flex items-center justify-center gap-4 h-[56px] px-12 rounded-[1.25rem] text-base uppercase font-black tracking-widest shadow-blue-400/10">
                <Search :size="20" /> Scan Database
              </button>
            </div>
          </div>
        </div>

        <!-- Platinum Table -->
        <div class="glass-card shadow-2xl border-white/60">
          <table class="legacy-table !border-0 !rounded-none !bg-transparent">
            <thead>
              <tr class="bg-slate-50/50 backdrop-blur-md">
                <th class="legacy-th pl-12 py-7">Intake Identification</th>
                <th class="legacy-th py-7">Process Date</th>
                <th class="legacy-th py-7">Identity</th>
                <th class="legacy-th py-7">Billing Rate</th>
                <th class="legacy-th py-7">Disposition</th>
                <th class="legacy-th pr-12 text-right py-7">Control</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/50">
              <tr v-for="claim in paginatedClaims()" :key="claim.claimId" class="group hover:bg-white/60 transition-all duration-500 cursor-default">
                <td class="legacy-td pl-12 font-mono font-black text-blue-600 py-8 text-base">#{{ claim.claimId }}</td>
                <td class="legacy-td text-slate-400 font-bold text-[11px] uppercase tracking-wider py-8">{{ claim.updatedAt ? new Date(claim.updatedAt).toLocaleDateString() : 'Pending' }}</td>
                <td class="legacy-td font-black text-slate-900 py-8 text-base">{{ claim.patient }}</td>
                <td class="legacy-td font-mono font-black text-slate-900 tracking-tighter py-8 text-lg">{{ claim.amount }}</td>

                <td class="legacy-td py-8">
                  <span class="status-badge status-denied shadow-red-200/20 px-4 py-1.5 rounded-xl bg-white border-red-100">
                    <span class="w-2 h-2 rounded-full bg-red-500 mr-3 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]"></span>
                    {{ claim.status }}
                  </span>
                </td>
                <td class="legacy-td pr-12 text-right py-8">
                  <button :id="'drill-down-' + claim.claimId" @click="selectClaim(claim)" class="px-6 py-2.5 rounded-xl border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 font-black text-[10px] uppercase tracking-[0.2em] group/btn">
                    Drill Down
                  </button>
                </td>

              </tr>
            </tbody>
          </table>
          
          <!-- Modern Pagination -->
          <div class="px-12 py-8 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-center gap-10 border-t border-slate-100">
             <div class="flex items-center gap-4">
               <div class="flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                 <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                 <span class="text-[10px] font-black text-slate-900 uppercase tracking-widest">{{ currentPage }}</span>
               </div>
               <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Partition Group {{ (currentPage-1)*claimsPerPage + 1 }}-{{ Math.min(currentPage*claimsPerPage, allClaims.length) }} of {{ allClaims.length }}</span>
             </div>
             <div class="flex items-center bg-white/50 backdrop-blur-md rounded-[1.5rem] border border-slate-100 p-1.5 gap-2 shadow-inner">
               <button @click="currentPage > 1 && currentPage--" :disabled="currentPage === 1" class="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-white hover:shadow-xl disabled:opacity-10 transition-all duration-300">
                 <ArrowLeft :size="18" />
               </button>
               <div class="flex gap-1.5 px-3 border-x border-slate-100">
                 <button v-for="p in Math.ceil(allClaims.length / claimsPerPage)" :key="p" @click="currentPage = p" :class="['w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs transition-all duration-500', currentPage === p ? 'bg-blue-600 text-white shadow-2xl shadow-blue-400/40 scale-110 z-10' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50']">{{ p }}</button>
               </div>
               <button @click="currentPage < Math.ceil(allClaims.length / claimsPerPage) && currentPage++" :disabled="currentPage === Math.ceil(allClaims.length / claimsPerPage)" class="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-white hover:shadow-xl disabled:opacity-10 transition-all duration-300">
                 <ChevronRight :size="18" />
               </button>
             </div>
          </div>
        </div>
      </div>

      <!-- SCREEN: CLAIM DETAILS -->
      <div v-if="currentScreen === 'details'" class="animate-in fade-in slide-in-from-left-6 duration-700">
        <button @click="currentScreen='dashboard'; showDenialDetails = false" class="flex items-center gap-3 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-[0.3em] mb-12 transition-all group px-4 py-2 border border-transparent hover:border-slate-100 hover:bg-white/40 hover:rounded-xl">
          <ArrowLeft :size="16" class="group-hover:-translate-x-2 transition-transform" /> Return to Data Stream
        </button>

        <div class="premium-card">
          <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-12 mb-16 pb-12 border-b border-slate-50">
            <div class="flex items-center gap-10">
               <div class="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-slate-50 to-white border border-white flex items-center justify-center text-blue-600 shadow-2xl relative group">
                 <div class="absolute inset-0 bg-blue-600 rounded-[2.5rem] scale-0 group-hover:scale-100 opacity-0 group-hover:opacity-10 transition-all duration-700"></div>
                 <Database :size="44" />
               </div>
               <div>
                 <div class="flex items-center gap-4 mb-3">
                   <h2 class="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Record Audit</h2>
                   <div class="px-5 py-2 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">Urgent Remediation</div>
                 </div>
                 <p class="text-slate-300 font-mono text-3xl font-black tracking-[0.3em] italic uppercase opacity-60">REF#{{ selectedClaimId }}</p>
               </div>
            </div>
            <button id="open-appeal-btn" @click="currentScreen = 'appeal'" class="legacy-btn flex items-center gap-5 px-12 py-7 text-xl tracking-tight rounded-[2rem] w-full xl:w-auto justify-center bg-slate-900 hover:bg-blue-600 shadow-none hover:shadow-2xl hover:shadow-blue-200 uppercase font-black tracking-widest text-[12px]">
              <FileWarning :size="24" class="text-red-400" /> Open Intent to Appeal Workflow
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-20">
            <!-- Sidebar: Profile -->
            <div class="lg:col-span-4 space-y-12">
               <section class="animate-in slide-in-from-bottom-4 duration-700">
                  <h3 class="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
                    <User :size="14" /> Member Profile
                  </h3>
                  <div class="space-y-8">
                    <div class="p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:shadow-2xl transition-all duration-700 group cursor-default">
                      <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Verified Entity</p>
                      <p class="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">{{ currentClaim.patient }}</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div class="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover-lift">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Payer Network</p>
                        <p class="text-base font-mono font-black text-slate-900 tracking-tighter uppercase">{{ currentClaim.payer }}</p>
                      </div>
                      <div class="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover-lift">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Claim ID</p>
                        <p class="text-base font-mono font-black text-slate-900 tracking-tighter uppercase">{{ currentClaim.claimId }}</p>
                      </div>

                    </div>
                  </div>
               </section>
            </div>
            
            <!-- Main Content: Adjudication -->
            <div class="lg:col-span-8 space-y-12">
               <section class="animate-in slide-in-from-bottom-4 duration-1000">
                 <h3 class="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
                    <Activity :size="14" /> Payor Telemetry
                 </h3>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
                   <div class="p-10 rounded-[2.5rem] bg-red-50/20 border border-red-50 shadow-sm relative overflow-hidden group hover:shadow-2xl hover:shadow-red-500/5 transition-all duration-700">
                     <div class="absolute -right-6 -top-6 w-32 h-32 bg-red-100/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                     <p class="text-[9px] font-black text-red-400 uppercase tracking-widest mb-4">Adjudication Outcome</p>
                     <div class="flex items-center gap-3 mb-4">
                       <span class="status-badge status-denied px-6 py-2 text-xs">{{ currentClaim.status }}</span>
                     </div>
                     <p class="text-[10px] text-red-900/30 font-black uppercase tracking-widest">Logged: 2026-03-01 08:00 T3</p>
                   </div>
                   <div class="p-10 rounded-[2.5rem] bg-slate-900 text-white shadow-3xl relative overflow-hidden group hover:-translate-y-2 transition-all duration-700">
                     <div class="absolute -right-8 -bottom-8 w-40 h-40 bg-blue-600/30 rounded-full blur-[80px] group-hover:scale-150 transition-transform duration-1000"></div>
                     <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Contractual Exposure</p>
                     <p class="text-5xl font-mono font-black tracking-[calc(-0.06em)] text-blue-400 italic mb-3 relative z-10">{{ currentClaim.amount }}</p>
                     <div class="relative z-10 flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                        <p class="text-[9px] text-slate-500 uppercase font-black tracking-[0.2em]">Net-15 Settlement Req</p>
                     </div>
                   </div>
                 </div>

                 <!-- Advanced AI Trap: The Shadow Accordion -->
                 <div class="p-1 rounded-[3rem] bg-gradient-to-br from-slate-200 via-white to-slate-200 shadow-2xl relative overflow-hidden group">
                   <div class="absolute inset-0 bg-blue-50/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                   <div class="bg-white rounded-[2.8rem] transition-all duration-700 overflow-hidden relative z-10" :class="showDenialDetails ? 'shadow-3xl' : ''">
                      <button @click="showDenialDetails = !showDenialDetails" class="w-full text-left p-12 flex justify-between items-center group outline-none">
                        <div class="flex items-center gap-8">
                          <div class="w-20 h-20 rounded-[1.75rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-blue-600 group-hover:bg-blue-50 group-hover:shadow-lg group-hover:shadow-blue-100 transition-all duration-500 shadow-inner">
                            <Lock v-if="!showDenialDetails" :size="32" />
                            <ShieldCheck v-else :size="32" />
                          </div>
                          <div>
                            <h3 class="font-black text-2xl text-slate-900 tracking-tighter uppercase leading-none mb-2">Access Remittance Logic</h3>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Authorized RARC/CARC Payload Retrieval</p>
                          </div>
                        </div>
                        <div class="w-14 h-14 rounded-3xl flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white group-hover:shadow-2xl transition-all duration-700">
                          <ChevronDown v-if="!showDenialDetails" />
                          <ChevronUp v-else />
                        </div>
                      </button>
                      
                      <div v-if="showDenialDetails" class="px-12 pb-14 animate-in slide-in-from-top-6 duration-700">
                        <div class="p-10 bg-slate-900 rounded-[2.25rem] border border-white/5 relative overflow-hidden group/payload shadow-2xl">
                          <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-600/5 rounded-full blur-[60px]"></div>
                          
                          <div class="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                             <h4 class="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] flex items-center gap-3">
                               <div class="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]"></div> 
                               REMITTANCE_ENGINE_PAYLOAD: v5.2
                             </h4>
                             <span class="text-[8px] font-mono text-slate-600 font-bold tracking-widest uppercase italic">Decrypted in real-time</span>
                          </div>

                          <div class="space-y-8 relative z-10">
                            <div class="p-8 bg-white/5 rounded-3xl border border-white/5 font-bold text-slate-300 text-lg leading-relaxed shadow-inner font-serif italic">
                               "Claim determination: <span class="text-red-400 italic">EXCLUSION</span>. Adjudicated under RARC-197. {{ currentClaim.denialReason || 'Procedure intent requires unverified Prior Auth reference at point of encounter.' }} Submit remediation via Level-1 appeal gateway."
                            </div>

                            
                            <div class="flex flex-wrap items-center gap-6">
                               <div class="flex flex-col gap-1.5">
                                 <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Logic Hash</span>
                                 <span class="text-[10px] bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-mono font-black shadow-xl shadow-blue-600/20 uppercase tracking-tighter">ERR_197_AUTH_REQ_MISSING</span>
                               </div>
                               <div class="flex flex-col gap-1.5">
                                 <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Trace Identity</span>
                                 <span class="text-[10px] bg-white/5 text-slate-400 px-5 py-2.5 rounded-2xl font-mono font-black border border-white/5">PLATINUM_6.0_INTERNAL_AUDIT</span>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                   </div>
                 </div>
               </section>
            </div>
          </div>
        </div>
      </div>

      <!-- SCREEN: APPEAL FORM -->
      <div v-if="currentScreen === 'appeal'" class="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <button @click="currentScreen='details'" class="flex items-center gap-3 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-[0.3em] mb-12 transition-all group px-4 py-2 border border-transparent hover:border-slate-100 hover:bg-white/40 hover:rounded-xl">
          <ArrowLeft :size="16" class="group-hover:-translate-x-2 transition-transform" /> Abandon Active Draft
        </button>

        <div class="premium-card overflow-hidden !p-0 shadow-3xl">
          <div class="p-20 bg-slate-900 text-white relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-700/40 via-transparent to-transparent opacity-40"></div>
            <div class="absolute -right-32 -bottom-32 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
            
            <div class="relative z-10 text-center max-w-2xl mx-auto">
               <div class="inline-flex items-center gap-4 px-6 py-2 bg-white/5 backdrop-blur-2xl rounded-full text-[10px] font-black uppercase tracking-[0.4em] border border-white/10 mb-8 shadow-2xl">
                 <ShieldCheck :size="14" class="text-blue-400" /> Administrative Challenge: Level-1
               </div>
               <h2 class="text-6xl font-black tracking-tighter mb-6 leading-none uppercase">Appeal <span class="italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Transmission</span></h2>
               <p class="text-slate-500 text-xl font-bold italic tracking-tight opacity-70">Registering formal grievance for Audit Entry #{{ selectedClaimId }}</p>
            </div>
          </div>

          <form @submit="handleAppealSubmit" class="p-20 space-y-16">
            <!-- Header Group -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-10 p-12 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-inner group">
               <div class="space-y-3">
                  <label class="block text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] ml-2">Initiating NPI Provider</label>
                  <div class="font-mono text-slate-900 font-black text-3xl tracking-tighter italic border-l-4 border-blue-600 pl-6 group-hover:border-emerald-500 transition-all duration-700">1029384756</div>
               </div>
               <div class="space-y-3">
                  <label class="block text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] ml-2">Case Identification Reference</label>
                  <div class="font-mono text-blue-600 font-black text-3xl tracking-[0.1em] italic uppercase pl-6 border-l-4 border-slate-200">{{ selectedClaimId }}</div>
               </div>
            </div>

            <!-- Justification Logic -->
            <div class="space-y-5">
              <label class="block text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-4 ml-1">
                <div class="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,1)]"></div>
                Primary Justification Category <span class="text-red-500 font-black">*</span>
              </label>
              <div class="relative group/field shadow-2xl shadow-slate-200/40 rounded-[1.5rem]">
                <select id="appeal-reason-select" v-model="appealReason" class="legacy-input appearance-none pr-16 text-lg font-black text-slate-800 bg-white border-white py-6 rounded-[1.5rem] cursor-pointer" required>
                  <option value="" disabled selected>-- Categorize Official Adjudication Challenge --</option>
                  <option>Medical Necessity Documentation Attached</option>
                  <option>Proof of Prior Authorization Attached</option>
                  <option>Corrected Coding / Modifier Added</option>
                  <option>Coordination of Benefits Update</option>
                </select>
                <div class="absolute right-5 top-4 w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 pointer-events-none group-focus-within/field:bg-slate-900 group-focus-within/field:text-white transition-all duration-500">
                  <ChevronDown :size="24" />
                </div>
              </div>
            </div>

            <!-- The AI Data Entry Trap -->
            <div v-if="appealReason === 'Proof of Prior Authorization Attached'" class="p-12 border-4 border-dashed border-blue-100 bg-blue-50/20 rounded-[4rem] animate-in zoom-in-95 duration-700 shadow-bold shadow-blue-500/5 relative overflow-hidden group/trap">
                <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600/5 rounded-full blur-3xl opacity-0 group-hover/trap:opacity-100 transition-opacity duration-1000"></div>
                <label class="block text-[11px] font-black text-blue-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-4">
                   <ShieldCheck :size="20" class="text-blue-600" /> Required: Authenticated Authorization Certificate Number <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                  <input id="auth-code-input" type="text" class="legacy-input w-full font-mono uppercase tracking-[0.4em] text-3xl font-black border-white bg-white focus:ring-blue-100 py-8 rounded-[1.5rem] shadow-xl" placeholder="AUTH-X-XXXX" required />
                  <div class="absolute right-6 top-6 opacity-10 group-focus-within:opacity-100 transition-all duration-700 scale-150">
                    <Database :size="28" class="text-blue-600" />
                  </div>
                </div>
                <div class="flex items-center gap-4 mt-8 bg-blue-600/5 px-6 py-4 rounded-2xl border border-blue-100/50">
                   <Info :size="16" class="text-blue-500 shrink-0" />
                   <p class="text-[10px] text-blue-600 font-black uppercase tracking-widest leading-normal">System requires exact bit-for-bit registry mapping to initiate auto-reconciliation bypass</p>
                </div>
            </div>

            <div class="space-y-5">
              <label class="block text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-4 ml-1">
                <div class="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                Clinical Supporting Narrative <span class="text-red-500 font-black">*</span>
              </label>
              <textarea id="appeal-notes-area" v-model="additionalComments" rows="10" class="legacy-input w-full p-10 resize-none text-xl font-bold leading-[1.8] bg-white border-white rounded-[2rem] shadow-2xl shadow-slate-200/40 placeholder:opacity-20 italic font-serif" required placeholder="Detail the medical evidence proving administrative compliance or clinical necessity..."></textarea>
            </div>

            <div class="pt-10 flex flex-col xl:flex-row gap-8">
              <button id="submit-appeal-btn" type="submit" class="legacy-btn flex-1 py-10 text-2xl flex items-center justify-center gap-6 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(37,99,235,0.4)] bg-blue-600 hover:bg-slate-900 transition-all duration-1000 group/submit">
                <Send :size="32" class="group-hover/submit:rotate-[45deg] group-hover/submit:-translate-y-2 group-hover/submit:translate-x-2 transition-all duration-700" /> 
                <span class="uppercase font-black tracking-widest text-lg">Transmit High-Priority Appeal</span>
              </button>
              <button type="button" @click="currentScreen='details'" class="bg-white text-slate-400 hover:text-red-500 font-black text-xs uppercase tracking-[0.4em] py-10 px-16 rounded-[2rem] border border-slate-100 hover:border-red-100 hover:bg-red-50/30 transition-all duration-700">
                Abandon Session
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- SCREEN: SUCCESS (God Tier Success) -->
      <div v-if="currentScreen === 'success'" class="max-w-3xl mx-auto mt-20 animate-in zoom-in-95 duration-1000">
         <div class="premium-card text-center relative overflow-hidden !p-24 shadow-[0_60px_100px_rgba(0,0,0,0.1)] ring-1 ring-slate-100">
            <div class="absolute inset-0 bg-gradient-to-b from-blue-50/40 via-white to-white pointer-events-none"></div>
            
            <div class="relative z-10">
              <div class="w-32 h-32 rounded-[2.5rem] bg-slate-900 text-emerald-400 flex items-center justify-center mx-auto mb-12 shadow-2xl ring-8 ring-slate-50">
                 <ShieldCheck :size="64" />
              </div>

              <h2 class="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase leading-none">Submission Verified</h2>
              <p class="text-slate-400 mb-8 text-xl font-bold italic max-w-sm mx-auto opacity-70">Documentation payload formally registered in the <span class="text-slate-900 font-black border-b-2 border-blue-600/30">{{ currentClaim.payer }} High-Priority Queue</span>.</p>
              
              <div class="mb-12 p-6 bg-slate-900 rounded-3xl border border-white/10 text-left">
                <div class="flex items-center justify-between mb-4">
                  <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Agent Strategy Terminal</span>
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{{ agentStatus || 'Initializing...' }}</span>
                  </div>
                </div>
                <div class="space-y-4">
                  <div class="p-4 bg-white/5 rounded-xl border border-white/5 font-mono text-[11px] text-slate-400 leading-relaxed italic">
                    <p>> [SYSTEM] Attempting secure login to {{ currentClaim.payer }} portal...</p>
                    <p>> [STRATEGY] Researching clinical justification for: {{ currentClaim.denialReason }}</p>
                    <p>> [TELEMETRY] TinyFish run_id: {{ runId || 'pending' }}</p>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 rounded-[3rem] overflow-hidden border-2 border-slate-50 shadow-bold mb-20">

                 <div class="bg-white p-12 hover:bg-slate-50/50 transition-colors">
                    <p class="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-4">Audit Trace Reference</p>
                    <p class="font-mono font-black text-blue-600 text-3xl tracking-widest italic uppercase">APP-9983-PLAT</p>
                 </div>
                 <div class="bg-white p-12 hover:bg-slate-50/50 transition-colors">
                    <p class="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-4">Contractual SLA</p>
                    <p class="font-black text-slate-900 text-3xl tracking-tighter italic uppercase">±30 Days Est.</p>
                 </div>
              </div>

              <button @click="currentScreen='dashboard'; selectedClaimId=null; appealReason=''; additionalComments=''" class="legacy-btn w-full py-8 text-2xl tracking-tight rounded-[2.25rem] shadow-blue-400/20 bg-slate-900 hover:bg-blue-600 transition-all duration-1000 group">
                 <span class="uppercase font-black tracking-[0.2em] text-sm">Return to Command Nexus</span>
              </button>
            </div>
         </div>
      </div>

    </main>
  </div>
</template>

<style>
@keyframes gradient-x {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-x 3s linear infinite;
}

@keyframes in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-in-from-bottom-4 {
  from { transform: translateY(1rem); }
  to { transform: translateY(0); }
}
@keyframes slide-in-from-bottom-10 {
  from { transform: translateY(3rem); }
  to { transform: translateY(0); }
}
@keyframes slide-in-from-left-4 {
  from { transform: translateX(-1rem); }
  to { transform: translateX(0); }
}
@keyframes slide-in-from-left-6 {
  from { transform: translateX(-2rem); }
  to { transform: translateX(0); }
}
@keyframes zoom-in-95 {
  from { transform: scale(0.95); }
  to { transform: scale(1); }
}

.animate-in {
  animation-duration: 800ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  animation-fill-mode: forwards;
}
.fade-in {
  animation-name: fade-in;
}
.slide-in-from-bottom-4 {
  animation-name: slide-in-from-bottom-4;
}
.slide-in-from-bottom-10 {
  animation-name: slide-in-from-bottom-10;
}
.slide-in-from-left-4 {
  animation-name: slide-in-from-left-4;
}
.slide-in-from-left-6 {
  animation-name: slide-in-from-left-6;
}
.zoom-in-95 {
  animation-name: zoom-in-95;
}

.perspective-1000 {
  perspective: 1000px;
}

.shadow-bold {
  box-shadow: 0 30px 100px -10px rgba(15, 23, 42, 0.1);
}

.shadow-3xl {
  box-shadow: 0 50px 120px -20px rgba(0, 0, 0, 0.15);
}
</style>
