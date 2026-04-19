<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Activity, CheckCircle, ShieldAlert, DollarSign, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const status = ref('loading') // loading | success | error
const errorMsg = ref('')
const profile = ref(null)
const claims = ref([])

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')

  if (error) {
    status.value = 'error'
    errorMsg.value = `CMS denied access: ${error}`
    return
  }

  if (!code) {
    status.value = 'error'
    errorMsg.value = 'No authorization code received from CMS.'
    return
  }

  try {
    const verifier = sessionStorage.getItem('cms_pkce_verifier');
    
    const res = await fetch(`${apiBaseUrl}/api/cms/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, verifier })
    })
    const data = await res.json()

    if (!data.success) {
      status.value = 'error'
      errorMsg.value = data.message || 'Token exchange failed.'
      return
    }

    profile.value = data.profile
    claims.value = data.claims || []
    status.value = 'success'
  } catch (err) {
    status.value = 'error'
    errorMsg.value = `Network error: ${err.message}`
  }
})

const goToDashboard = () => router.push({ name: 'Dashboard' })
</script>

<template>
  <div class="min-h-screen bg-[#0A0C10] text-[#E2E8F0] font-sans flex flex-col">

    <!-- Navbar -->
    <nav class="border-b border-[#1E293B] bg-[#0F172A]/80 backdrop-blur-md px-8 py-4 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-blue-500/20">
        <Activity class="w-5 h-5 text-white" />
      </div>
      <span class="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">RevRecover</span>
      <span class="text-xs font-semibold px-2 py-0.5 rounded-full border bg-[#1E293B] text-slate-400 border-slate-700 ml-1">Medicare Connect</span>
    </nav>

    <main class="flex-1 flex items-center justify-center p-8">

      <!-- LOADING -->
      <div v-if="status === 'loading'" class="text-center">
        <div class="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin mx-auto mb-6"></div>
        <h2 class="text-2xl font-bold text-white mb-2">Connecting to Medicare</h2>
        <p class="text-slate-400">Exchanging credentials with CMS sandbox...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="status === 'error'" class="text-center max-w-md">
        <div class="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert class="w-8 h-8 text-red-400" />
        </div>
        <h2 class="text-2xl font-bold text-white mb-2">Connection Failed</h2>
        <p class="text-slate-400 text-sm mb-6">{{ errorMsg }}</p>
        <button @click="goToDashboard" class="px-6 py-2.5 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-700 transition">
          Return to Dashboard
        </button>
      </div>

      <!-- SUCCESS -->
      <div v-else class="w-full max-w-2xl">
        <!-- Success header -->
        <div class="text-center mb-8">
          <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle class="w-8 h-8 text-emerald-400" />
          </div>
          <h2 class="text-3xl font-bold text-white mb-1">Medicare Connected</h2>
          <p class="text-slate-400 text-sm">Live data retrieved from CMS BlueButton 2.0 sandbox</p>
        </div>

        <!-- Patient Identity Card -->
        <div class="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 mb-5 relative overflow-hidden">
          <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl"></div>
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Authorized Beneficiary</div>
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-blue-500/20">
              {{ (profile?.name || 'M')[0] }}
            </div>
            <div>
              <div class="text-white font-bold text-lg">{{ profile?.name || 'Medicare Beneficiary' }}</div>
              <div class="text-slate-500 text-xs font-mono mt-0.5">Patient ID: {{ profile?.patientId || profile?.fhirId || 'N/A' }}</div>
            </div>
            <div class="ml-auto px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              ✓ Verified Live
            </div>
          </div>
        </div>

        <!-- Live Claims from CMS -->
        <div class="bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden mb-5">
          <div class="px-6 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <div>
              <div class="text-white font-bold">Live Medicare Claims (EOB)</div>
              <div class="text-slate-500 text-xs mt-0.5">Retrieved from FHIR ExplanationOfBenefit endpoint</div>
            </div>
            <span class="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold font-mono">FHIR R4</span>
          </div>

          <div v-if="claims.length === 0" class="px-6 py-8 text-center text-slate-500 text-sm">
            No claims returned from CMS sandbox for this beneficiary.
          </div>

          <div v-for="(claim, i) in claims" :key="claim.id" class="px-6 py-4 border-b border-[#1E293B]/50 last:border-0 flex items-center justify-between hover:bg-[#1E293B]/30 transition">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-[#1E293B] flex items-center justify-center text-slate-400 text-xs font-bold font-mono">
                {{ i + 1 }}
              </div>
              <div>
                <div class="text-slate-200 font-semibold text-sm">{{ claim.type }}</div>
                <div class="text-slate-500 text-xs font-mono mt-0.5">{{ claim.id }}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-white font-bold text-sm">
                {{ claim.total ? `$${Number(claim.total).toLocaleString()}` : 'N/A' }}
              </div>
              <div :class="['text-xs px-2 py-0.5 rounded-full font-bold mt-1', claim.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400']">
                {{ claim.status || 'unknown' }}
              </div>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="flex gap-3 justify-center">
          <button @click="goToDashboard" class="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
            Return to Dashboard <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>

    </main>
  </div>
</template>
