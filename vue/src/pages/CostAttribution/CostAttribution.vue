<template>
  <div class="cost-attribution">
    <b-breadcrumb>
      <b-breadcrumb-item active>Summary</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Summary - <span class="fw-semi-bold">Cost Attribution</span>
    </h1>

    <b-alert v-if="error" variant="danger" show>{{ error }}</b-alert>

    <div class="cost-summary mb-4">
      <div class="cost-summary__label">Estimated monthly total</div>
      <div class="cost-summary__value" data-cy="cost-total">{{ formatCurrency(totalMonthlyEstimate) }}</div>
      <div class="cost-summary__meta">
        Client-side estimate<span v-if="lastLoadedAt"> updated {{ formatDate(lastLoadedAt) }}</span>
      </div>
    </div>

    <div v-if="loading" class="py-4 text-center" data-cy="cost-loading">Loading...</div>

    <div v-else>
      <div class="table-responsive">
        <table class="table table-striped table-sm cost-table" data-cy="cost-table">
          <thead>
            <tr>
              <th>Component</th>
              <th class="text-right">Usage</th>
              <th>Unit cost</th>
              <th class="text-right">Estimated monthly</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key" data-cy="cost-row">
              <td>
                <strong>{{ row.component }}</strong>
              </td>
              <td class="text-right">
                {{ row.quantity }} {{ pluralize(row.unitLabel, row.quantity) }}
              </td>
              <td class="cost-table__unit">
                <b-input-group size="sm" prepend="$">
                  <b-form-input
                    type="number"
                    min="0"
                    step="0.01"
                    :value="formatUnitCost(row.unitCost)"
                    :data-cy="'unit-cost-' + row.key"
                    @input="value => updateCost(row.key, value)"
                  />
                </b-input-group>
              </td>
              <td class="text-right" :data-cy="'estimated-cost-' + row.key">
                {{ formatCurrency(row.estimatedMonthlyCost) }}
              </td>
              <td class="text-muted">{{ row.dataSource }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="d-flex align-items-center mb-4">
        <b-button variant="outline-primary" size="sm" :disabled="loading" @click="fetchCostAttribution">
          Refresh estimates
        </b-button>
        <b-button variant="link" size="sm" class="ml-2" @click="resetCostOverrides">
          Reset unit costs
        </b-button>
      </div>

      <section class="cost-assumptions">
        <h2>Assumptions</h2>
        <ul>
          <li>Estimates are calculated in this browser from the resources currently returned by the console APIs.</li>
          <li>Firmware builds use the recent build log returned by /logs/build as the current monthly usage signal.</li>
          <li>Unit costs are local browser overrides and are not saved to the THiNX backend.</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters, mapState } from 'vuex';

export default {
  name: 'CostAttribution',
  computed: {
    ...mapState('costAttribution', {
      loading: state => state.loading,
      error: state => state.error,
      lastLoadedAt: state => state.lastLoadedAt,
    }),
    ...mapGetters('costAttribution', ['rows', 'totalMonthlyEstimate']),
  },
  created() {
    this.fetchCostAttribution();
  },
  methods: {
    ...mapActions('costAttribution', {
      fetchCostAttribution: 'fetchItems',
      updateUnitCost: 'updateUnitCost',
      resetUnitCosts: 'resetUnitCosts',
    }),
    updateCost(key, value) {
      if (value === '') {
        return;
      }
      this.updateUnitCost({ key, value });
    },
    resetCostOverrides() {
      this.resetUnitCosts();
    },
    formatCurrency(value) {
      const numberValue = Number(value) || 0;
      return '$' + numberValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    formatUnitCost(value) {
      return String(Number(value) || 0);
    },
    formatDate(value) {
      if (!value) {
        return '';
      }
      return new Date(value).toLocaleString();
    },
    pluralize(label, quantity) {
      if (quantity === 1) {
        return label;
      }
      if (label === 'recent build') {
        return 'recent builds';
      }
      return label + 's';
    },
  },
};
</script>

<style lang="scss" scoped>
.cost-attribution {
  .cost-summary {
    border-left: 4px solid #21ae8c;
    padding: 16px 20px;
    background: #fff;
  }

  .cost-summary__label {
    color: #6c757d;
    font-size: 0.875rem;
    text-transform: uppercase;
  }

  .cost-summary__value {
    color: #29323a;
    font-size: 2rem;
    font-weight: 600;
    line-height: 1.2;
    margin-top: 4px;
  }

  .cost-summary__meta {
    color: #6c757d;
    margin-top: 4px;
  }

  .cost-table th,
  .cost-table td {
    vertical-align: middle;
  }

  .cost-table__unit {
    min-width: 150px;
    width: 180px;
  }

  .cost-assumptions {
    max-width: 820px;
  }

  .cost-assumptions h2 {
    font-size: 1.25rem;
  }
}
</style>
