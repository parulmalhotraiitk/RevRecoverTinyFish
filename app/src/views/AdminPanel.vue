<template>
  <div class="min-h-screen bg-slate-50 selection:bg-blue-500 selection:text-white font-sans pb-20">
    <!-- Navbar -->
    <nav class="border-b sticky top-0 z-50 backdrop-blur-md bg-white/80 border-slate-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 items-center">
          <div class="flex items-center gap-4">
            <button @click="router.push('/')" class="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <ArrowLeft class="w-5 h-5" />
            </button>
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Shield class="w-4 h-4 text-white" />
            </div>
            <span class="font-bold text-xl tracking-tight text-slate-800">Admin Control Panel</span>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
      
      <!-- Header -->
      <div class="mb-8 flex justify-between items-end">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 mb-1">User Management</h1>
          <p class="text-sm text-slate-500">Securely provision and manage roles for hospital employees.</p>
        </div>
        
        <button 
          @click="showCreateModal = true"
          class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all"
        >
          <UserPlus class="w-4 h-4" /> Add Employee
        </button>
      </div>

      <!-- Users Table Container -->
      <div class="bg-white border text-slate-800 border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
        
        <div v-if="isLoading" class="p-12 flex justify-center">
          <svg class="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>

        <table v-else class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th class="px-6 py-4 font-semibold">Employee</th>
              <th class="px-6 py-4 font-semibold">Role / Group</th>
              <th class="px-6 py-4 font-semibold">Join Date</th>
              <th class="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="user in users" :key="user._id" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <UserCircle class="w-6 h-6" />
                  </div>
                  <div>
                    <div class="font-bold text-sm text-slate-900">{{ user.name }}</div>
                    <div class="text-xs text-slate-500">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span :class="['px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 w-fit', roleColors(user.role)]">
                  <component :is="roleIcon(user.role)" class="w-3.5 h-3.5" />
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-slate-500 font-medium">
                {{ new Date(user.createdAt).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 text-right">
                <button 
                  @click="deleteUser(user._id)" 
                  v-if="user._id !== currentUser.id"
                  class="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border hover:border-red-200 border-transparent"
                  title="Revoke Access"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <!-- Create User Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="showCreateModal = false"></div>
      
      <div class="relative bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 my-auto transform transition-all">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold text-slate-900">Provision Employee</h2>
          <button @click="showCreateModal = false" class="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="createUser" class="space-y-4">
          <div v-if="errorMsg" class="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs font-semibold">
            {{ errorMsg }}
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Full Name</label>
            <input v-model="form.name" type="text" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Dr. Jane Doe" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Corporate Email</label>
            <input v-model="form.email" type="email" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="jane@hospital.org" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Temporary Password</label>
            <input v-model="form.password" type="password" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Role Assignment</label>
            <select v-model="form.role" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-medium">
              <option value="Appeals Specialist">Appeals Specialist (Base Tier)</option>
              <option value="Auditor">Auditor (Read-Only History)</option>
              <option value="Billing Manager">Billing Manager (Leadership + Rev Metrics)</option>
              <option value="System Admin">System Admin (Full Access)</option>
            </select>
          </div>

          <button 
            type="submit" 
            :disabled="isCreating"
            class="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {{ isCreating ? 'Provisioning...' : 'Provision Access' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Shield, UserPlus, UserCircle, Settings, Trash2, X, Eye, DollarSign, Activity } from 'lucide-vue-next';

const router = useRouter();
const users = ref([]);
const isLoading = ref(true);
const showCreateModal = ref(false);
const isCreating = ref(false);
const errorMsg = ref('');

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const form = reactive({
  name: '',
  email: '',
  password: '',
  role: 'Appeals Specialist'
});

const roleColors = (role) => {
  switch(role) {
    case 'System Admin': return 'bg-red-50 text-red-600 border-red-200';
    case 'Billing Manager': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'Appeals Specialist': return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'Auditor': return 'bg-purple-50 text-purple-600 border-purple-200';
    default: return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

const roleIcon = (role) => {
  switch(role) {
    case 'System Admin': return Shield;
    case 'Billing Manager': return DollarSign;
    case 'Appeals Specialist': return Activity;
    case 'Auditor': return Eye;
    default: return UserCircle;
  }
};

const fetchUsers = async () => {
  isLoading.value = true;
  try {
    const res = await fetch(`${apiBaseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      users.value = data.users;
    }
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const createUser = async () => {
  isCreating.value = true;
  errorMsg.value = '';
  try {
    const res = await fetch(`${apiBaseUrl}/api/users`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.success) {
      showCreateModal.value = false;
      form.name = '';
      form.email = '';
      form.password = '';
      form.role = 'Appeals Specialist';
      await fetchUsers();
    } else {
      errorMsg.value = data.message;
    }
  } catch(err) {
    errorMsg.value = 'Network error.';
  } finally {
    isCreating.value = false;
  }
};

const deleteUser = async (id) => {
  if (confirm('Permanently revoke access for this employee?')) {
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        users.value = users.value.filter(u => u._id !== id);
      }
    } catch(err) {
      console.error(err);
    }
  }
};

onMounted(() => {
  if(currentUser.role !== 'System Admin') {
    router.push('/');
    return;
  }
  fetchUsers();
});
</script>
