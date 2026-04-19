<template>
  <div class="min-h-screen bg-[#0F172A] relative flex items-center justify-center overflow-hidden font-sans">
    <!-- Ambient Background Lighting -->
    <div class="absolute inset-0 z-0">
      <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
      <div class="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[120px] animation-delay-2000"></div>
    </div>

    <!-- Main Container -->
    <div class="z-10 w-full max-w-md p-8 relative">
      <!-- Title -->
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <h1 class="text-3xl font-extrabold text-white tracking-tight">RevRecover <span class="text-blue-400">Enterprise</span></h1>
        <p class="text-slate-400 mt-2 font-medium">Billing Administrator Portal</p>
      </div>

      <!-- Glassmorphic Card -->
      <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
        
        <div class="mb-8">
          <h2 class="text-xl font-bold text-white mb-2">Sign In</h2>
          <p class="text-xs text-slate-400">Enter your credentials to access the secure hospital portal.</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- Error Message Alert -->
          <div v-if="errorMsg" class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-medium flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {{ errorMsg }}
          </div>

          <!-- Email Field -->
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Corporate Email</label>
            <input 
              v-model="form.email" 
              type="email" 
              required
              class="w-full bg-slate-800 border-none rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="admin@hospital.org"
            />
          </div>

          <!-- Password Field -->
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Secure Password</label>
            <input 
              v-model="form.password" 
              type="password" 
              required
              class="w-full bg-slate-800 border-none rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <!-- Submit Button -->
          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex justify-center items-center gap-2 mt-6 disabled:opacity-50"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Access Authenticated Portal
          </button>
        </form>

        <p class="text-center text-xs text-slate-500 font-medium mt-8 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          256-bit AES Encrypted Connection
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const isLoading = ref(false);
const errorMsg = ref('');

const form = reactive({
  email: '',
  password: ''
});

const handleSubmit = async () => {
  isLoading.value = true;
  errorMsg.value = '';

  const endpoint = '/api/auth/login';
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await res.json();

    if (!data.success) {
      errorMsg.value = data.message || 'Authentication failed.';
    } else {
      // Securely store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect to dashboard
      router.push({ name: 'Dashboard' });
    }
  } catch (err) {
    console.error(err);
    errorMsg.value = 'Network error. Please ensure the backend is running.';
  } finally {
    isLoading.value = false;
  }
};
</script>
