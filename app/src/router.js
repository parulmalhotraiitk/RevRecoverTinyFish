import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from './views/Dashboard.vue';
import Login from './views/Login.vue';
import AdminPanel from './views/AdminPanel.vue';
import CmsCallback from './views/CmsCallback.vue';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/admin',
    name: 'AdminPanel',
    component: AdminPanel,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    // CMS BlueButton OAuth callback — no auth required (CMS redirects here with ?code=)
    path: '/cms-callback',
    name: 'CmsCallback',
    component: CmsCallback,
    meta: { requiresAuth: false }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Route Guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  let user = null;
  if(userJson) {
      try { user = JSON.parse(userJson); } catch(e){}
  }
  
  if (to.meta.requiresAuth && !token) {
    // Redirect to login if unauthenticated
    next({ name: 'Login' });
  } else if (to.name === 'Login' && token) {
    // Bounce authenticated users away from Login back to Dashboard
    next({ name: 'Dashboard' });
  } else if (to.meta.requiresAdmin && (!user || user.role !== 'System Admin')) {
    // Bounce non-admins away from the admin panel
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

export default router;
