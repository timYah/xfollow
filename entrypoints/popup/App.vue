<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { getSettings, updateSettings, resetFollowedHistory, type Settings } from '../../utils/storage';

interface Stats {
  total: number;
  remaining: number;
  processed: number;
  success: number;
  status: 'idle' | 'running' | 'paused' | 'stopped';
}

const stats = ref<Stats>({
  total: 0,
  remaining: 0,
  processed: 0,
  success: 0,
  status: 'idle'
});

const detectedCount = ref(0);
const showSettings = ref(false);
const settings = ref<Settings>({
  minDelay: 1500,
  maxDelay: 4000,
  skipFollowed: true
});

const fetchStatus = async () => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' });
      if (response) {
        stats.value = response;
        if (response.detectedCount !== undefined) {
          detectedCount.value = response.detectedCount;
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch status:', error);
  }
};

const loadSettings = async () => {
  settings.value = await getSettings();
};

const saveSettings = async () => {
  await updateSettings(settings.value);
  showSettings.value = false;
};

const resetHistory = async () => {
  if (confirm('Are you sure you want to reset the followed users history?')) {
    await resetFollowedHistory();
    alert('History reset successfully!');
  }
};

const startFollowing = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    await browser.tabs.sendMessage(tabs[0].id, { type: 'START_FOLLOW' });
    stats.value.status = 'running';
  }
};

const stopFollowing = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    await browser.tabs.sendMessage(tabs[0].id, { type: 'STOP_FOLLOW' });
    stats.value.status = 'stopped';
  }
};

// Listen for updates from content script
const handleMessage = (message: any) => {
  if (message.type === 'USERS_UPDATED') {
    detectedCount.value = message.data.count;
  }
};

let timer: number;

onMounted(() => {
  fetchStatus();
  loadSettings();
  timer = window.setInterval(fetchStatus, 1000);
  browser.runtime.onMessage.addListener(handleMessage);
});

onUnmounted(() => {
  clearInterval(timer);
  browser.runtime.onMessage.removeListener(handleMessage);
});

const progressWidth = computed(() => {
  if (stats.value.total === 0) return '0%';
  return `${(stats.value.processed / stats.value.total) * 100}%`;
});
</script>

<template>
  <div class="container">
    <header>
      <div class="logo-box">
        <span class="logo-icon">✨</span>
        <h1>xfollow</h1>
      </div>
      <p class="subtitle">Auto-follow premium users on X</p>
    </header>

    <main v-if="!showSettings">
      <div class="card status-card">
        <div class="stat-item">
          <span class="label">Detected Premium</span>
          <span class="value">{{ detectedCount }}</span>
        </div>
        
        <div v-if="stats.status !== 'idle' && stats.status !== 'stopped'" class="progress-section">
          <div class="stat-row">
            <span>Following... {{ stats.processed }} / {{ stats.total }}</span>
            <span>{{ stats.success }} success</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressWidth }"></div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button v-if="stats.status === 'idle' || stats.status === 'stopped'" @click="startFollowing" class="btn-primary" :disabled="detectedCount === 0">
          Start Following All
        </button>
        <button v-else @click="stopFollowing" class="btn-danger">
          Stop Auto-Follow
        </button>

        <button @click="showSettings = true" class="btn-secondary">
          ⚙️ Settings
        </button>
      </div>
    </main>

    <main v-else class="settings-panel">
      <h2>Settings</h2>
      
      <div class="setting-group">
        <label>
          <input type="checkbox" v-model="settings.skipFollowed" />
          Skip already followed users
        </label>
      </div>

      <div class="setting-group">
        <label>Min Delay (ms)</label>
        <input type="number" v-model.number="settings.minDelay" min="500" max="5000" />
      </div>

      <div class="setting-group">
        <label>Max Delay (ms)</label>
        <input type="number" v-model.number="settings.maxDelay" min="1000" max="10000" />
      </div>

      <div class="setting-group">
        <button @click="resetHistory" class="btn-danger-outline">
          Reset Followed History
        </button>
      </div>

      <div class="actions">
        <button @click="saveSettings" class="btn-primary">
          Save Settings
        </button>
        <button @click="showSettings = false" class="btn-secondary">
          Cancel
        </button>
      </div>
    </main>

    <footer>
      <p>Made with ❤️ for X power users</p>
    </footer>
  </div>
</template>

<style>
:root {
  --primary: #1d9bf0;
  --primary-hover: #1a8cd8;
  --bg: #ffffff;
  --text: #0f1419;
  --text-muted: #536471;
  --card-bg: #f7f9f9;
  --danger: #f4212e;
  --border: #eff3f4;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --text: #e7e9ea;
    --text-muted: #71767b;
    --card-bg: #16181c;
    --border: #2f3336;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  width: 350px;
}

.container {
  padding: 24px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

header {
  text-align: center;
  margin-bottom: 24px;
}

.logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
}

.logo-icon {
  font-size: 24px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

h1 {
  font-size: 24px;
  font-weight: 800;
  margin: 0;
}

h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

.card {
  background-color: var(--card-bg);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  transition: transform 0.2s;
}

.card:hover {
  transform: translateY(-2px);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.label {
  font-size: 13px;
  color: var(--text-muted);
}

.value {
  font-size: 32px;
  font-weight: 800;
  animation: countUp 0.5s ease;
}

@keyframes countUp {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.progress-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 8px;
  margin-left: 4px;
  color: var(--text-muted);
}

.progress-bar {
  height: 6px;
  background-color: rgba(128, 128, 128, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--primary);
  transition: width 0.3s ease;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  border-radius: 9999px;
  border: none;
  background-color: var(--primary);
  color: white;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
  transform: scale(1.02);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  width: 100%;
  padding: 12px;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background-color: var(--card-bg);
}

.btn-danger {
  width: 100%;
  padding: 12px;
  border-radius: 9999px;
  border: 1px solid rgba(244, 33, 46, 0.5);
  background-color: transparent;
  color: var(--danger);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background-color: rgba(244, 33, 46, 0.1);
}

.btn-danger-outline {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--danger);
  background-color: transparent;
  color: var(--danger);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger-outline:hover {
  background-color: rgba(244, 33, 46, 0.1);
}

.settings-panel {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

.setting-group {
  margin-bottom: 16px;
}

.setting-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text);
}

.setting-group input[type="checkbox"] {
  margin-right: 8px;
  cursor: pointer;
}

.setting-group input[type="number"] {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background-color: var(--card-bg);
  color: var(--text);
  font-size: 14px;
}

.setting-group input[type="number"]:focus {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

footer {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 24px;
}
</style>
