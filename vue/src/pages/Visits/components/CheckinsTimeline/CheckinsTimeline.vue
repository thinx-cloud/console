<template>
  <div>
    <div v-if="hasData" style="height:280px">
      <line-chart :chart-data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="text-muted text-center py-5">
      No check-in data for this range.
    </div>
  </div>
</template>

<script>
import { Line, mixins } from 'vue-chartjs';

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const LineChart = {
  extends: Line,
  mixins: [mixins.reactiveProp],
  props: ['chartData', 'options'],
  mounted() {
    this.renderChart(this.chartData, this.options);
  },
};

export default {
  name: 'CheckinsTimeline',

  components: { LineChart },

  props: {
    range: {
      type: Number,
      default: 7,
      validator: v => [7, 31, 365].includes(v),
    },
    checkins: {
      type: Array,
      default: () => [],
    },
  },

  computed: {
    dailyCounts() {
      return this.checkins.reduce((acc, record) => {
        if (!record || !record.date) return acc;
        const d = new Date(record.date);
        if (isNaN(d.getTime())) return acc;
        const key = dayKey(d);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    },

    dateAxis() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = [];
      for (let i = this.range - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(dayKey(d));
      }
      return days;
    },

    chartData() {
      return {
        labels: this.dateAxis,
        datasets: [
          {
            label: 'Device check-ins',
            data: this.dateAxis.map(day => this.dailyCounts[day] || 0),
            borderColor: '#3598dc',
            backgroundColor: 'rgba(53,152,220,0.1)',
            fill: true,
            pointRadius: 2,
          },
        ],
      };
    },

    chartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          yAxes: [{ ticks: { beginAtZero: true, precision: 0 } }],
        },
      };
    },

    hasData() {
      return this.checkins.length > 0;
    },
  },
};
</script>
