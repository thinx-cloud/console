const STORAGE_KEY = 'thinx.costAttribution.unitCosts';

export const DEFAULT_PRICE_CARD = {
  devices: 0.1,
  repositories: 1.5,
  firmwareBuilds: 0.25,
  apiKeys: 0.05,
  environmentVariables: 0.01,
  meshChannels: 0.2,
  transformers: 0.1,
};

export const COST_COMPONENTS = [
  {
    key: 'devices',
    component: 'Devices',
    unitLabel: 'device',
    dataSource: 'GET /device',
  },
  {
    key: 'repositories',
    component: 'Repositories',
    unitLabel: 'repository',
    dataSource: 'GET /source',
  },
  {
    key: 'firmwareBuilds',
    component: 'Firmware builds',
    unitLabel: 'recent build',
    dataSource: 'GET /logs/build',
  },
  {
    key: 'apiKeys',
    component: 'API keys',
    unitLabel: 'key',
    dataSource: 'GET /apikey',
  },
  {
    key: 'environmentVariables',
    component: 'Environment variables',
    unitLabel: 'variable',
    dataSource: 'GET /env',
  },
  {
    key: 'meshChannels',
    component: 'Mesh channels',
    unitLabel: 'channel',
    dataSource: 'GET /mesh',
  },
  {
    key: 'transformers',
    component: 'Transformers',
    unitLabel: 'transformer',
    dataSource: 'GET /profile info.transformers',
  },
];

function cloneDefaultPriceCard() {
  return { ...DEFAULT_PRICE_CARD };
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).map(key => value[key]);
  }
  return [];
}

function normalizeCost(value, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return fallback;
  }
  return numberValue;
}

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function getStoredUnitCosts() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function persistUnitCosts(unitCosts) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unitCosts));
}

function mergeUnitCosts(overrides) {
  const merged = cloneDefaultPriceCard();
  Object.keys(merged).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      merged[key] = normalizeCost(overrides[key], merged[key]);
    }
  });
  return merged;
}

export function loadUnitCosts() {
  return mergeUnitCosts(getStoredUnitCosts());
}

export function normalizeResourceCounts(rootState) {
  const state = rootState || {};

  return {
    devices: asArray(state.devices && state.devices.items).length,
    repositories: asArray(state.repositories && state.repositories.items).length,
    firmwareBuilds: asArray(state.buildlog && state.buildlog.items).length,
    apiKeys: asArray(state.apikeys && state.apikeys.items).length,
    environmentVariables: asArray(state.enviros && state.enviros.items).length,
    meshChannels: asArray(state.channels && state.channels.items).length,
    transformers: asArray(state.transformers && state.transformers.items).length,
  };
}

export function buildCostRows(rootState, unitCosts) {
  const counts = normalizeResourceCounts(rootState);
  const costs = mergeUnitCosts(unitCosts || {});

  return COST_COMPONENTS.map(component => {
    const quantity = counts[component.key] || 0;
    const unitCost = normalizeCost(costs[component.key], DEFAULT_PRICE_CARD[component.key]);

    return {
      ...component,
      quantity,
      unitCost,
      estimatedMonthlyCost: roundCurrency(quantity * unitCost),
    };
  }).sort((a, b) => {
    if (b.estimatedMonthlyCost !== a.estimatedMonthlyCost) {
      return b.estimatedMonthlyCost - a.estimatedMonthlyCost;
    }
    return a.component.localeCompare(b.component);
  });
}

export default {
  namespaced: true,
  state: {
    loading: false,
    error: null,
    unitCosts: cloneDefaultPriceCard(),
    lastLoadedAt: null,
  },
  mutations: {
    setLoading(state, loading) {
      state.loading = loading;
    },
    setError(state, error) {
      state.error = error;
    },
    setUnitCosts(state, unitCosts) {
      state.unitCosts = mergeUnitCosts(unitCosts || {});
    },
    setUnitCost(state, { key, value }) {
      if (!Object.prototype.hasOwnProperty.call(state.unitCosts, key)) {
        return;
      }
      state.unitCosts = {
        ...state.unitCosts,
        [key]: normalizeCost(value, state.unitCosts[key]),
      };
    },
    setLastLoadedAt(state, lastLoadedAt) {
      state.lastLoadedAt = lastLoadedAt;
    },
  },
  actions: {
    async fetchItems({ commit, dispatch }) {
      commit('setLoading', true);
      commit('setError', null);
      commit('setUnitCosts', loadUnitCosts());

      try {
        await Promise.all([
          dispatch('devices/fetchItems', null, { root: true }),
          dispatch('repositories/fetchItems', null, { root: true }),
          dispatch('buildlog/fetchBuildLog', null, { root: true }),
          dispatch('apikeys/fetchItems', null, { root: true }),
          dispatch('enviros/fetchItems', null, { root: true }),
          dispatch('channels/fetchItems', null, { root: true }),
          dispatch('transformers/fetchItems', null, { root: true }),
        ]);
        commit('setLastLoadedAt', new Date().toISOString());
      } catch (error) {
        commit(
          'setError',
          error && error.message ? error.message : 'Failed to load cost attribution resources.'
        );
      } finally {
        commit('setLoading', false);
      }
    },
    updateUnitCost({ commit, state }, { key, value }) {
      commit('setUnitCost', { key, value });
      persistUnitCosts(state.unitCosts);
    },
    resetUnitCosts({ commit, state }) {
      commit('setUnitCosts', cloneDefaultPriceCard());
      persistUnitCosts(state.unitCosts);
    },
  },
  getters: {
    rows(state, getters, rootState) {
      return buildCostRows(rootState, state.unitCosts);
    },
    totalMonthlyEstimate(state, getters) {
      return roundCurrency(getters.rows.reduce((total, row) => total + row.estimatedMonthlyCost, 0));
    },
  },
};
