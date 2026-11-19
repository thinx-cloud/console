<template>
  <div class="device-map" :style="{ height: height + 'px' }">
    <div ref="chart" class="device-map-chart" role="img" :aria-label="ariaLabel"></div>
    <div v-if="loadError" class="device-map-error text-muted small" data-cy="device-map-error">The map could not be loaded.</div>
  </div>
</template>

<script>
// A world map with one circle pin per entry of `pins` (see devicePins() in utils/deviceGeo.js).
// amCharts 4 and its bundled world geodata are loaded as a separate chunk from this origin:
// no tiles, scripts or fonts come from anywhere else, so the console CSP needs no new host.
// Tooltips are plain SVG text set from each pin's pre-escaped `tooltip`, never HTML.
import { pinBounds } from '@/utils/deviceGeo';

const PIN_FILL = '#C7D0FF';
const LAND_FILL = '#474D84';
const LAND_STROKE = '#6979C9';

export default {
  name: 'DeviceMap',
  props: {
    pins: { type: Array, required: true },
    height: { type: Number, default: 360 },
    // Emit 'select' with the pin's udid on click (the Dashboard opens Device Detail).
    clickable: { type: Boolean, default: false },
    maxZoomLevel: { type: Number, default: 64 },
  },
  data() {
    return { loadError: false };
  },
  computed: {
    ariaLabel() {
      const n = this.pins.length;
      return 'Map with ' + n + (n === 1 ? ' device location' : ' device locations');
    },
  },
  watch: {
    pins() {
      this.applyPins();
    },
  },
  mounted() {
    this.destroyed = false;
    this.chart = null;
    Promise.all([
      import(/* webpackChunkName: "device-map" */ '@amcharts/amcharts4/core'),
      import(/* webpackChunkName: "device-map" */ '@amcharts/amcharts4/maps'),
      import(/* webpackChunkName: "device-map" */ '@amcharts/amcharts4-geodata/worldLow'),
    ]).then(([am4core, am4maps, geodata]) => {
      if (this.destroyed) return;
      this.createChart(am4core, am4maps, geodata.default || geodata);
    }).catch((err) => {
      if (this.destroyed) return;
      this.loadError = true;
      console.warn('Device map unavailable:', err && err.message);
    });
  },
  beforeDestroy() {
    this.destroyed = true;
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  },
  methods: {
    createChart(am4core, am4maps, worldLow) {
      const chart = am4core.create(this.$refs.chart, am4maps.MapChart);
      chart.geodata = worldLow;
      chart.projection = new am4maps.projections.Miller();
      chart.maxZoomLevel = this.maxZoomLevel;
      chart.chartContainer.wheelable = false;

      const land = chart.series.push(new am4maps.MapPolygonSeries());
      land.useGeodata = true;
      land.exclude = ['AQ'];
      land.mapPolygons.template.fill = am4core.color(LAND_FILL);
      land.mapPolygons.template.stroke = am4core.color(LAND_STROKE);
      land.mapPolygons.template.strokeWidth = 0.5;

      chart.zoomControl = new am4maps.ZoomControl();
      chart.zoomControl.align = 'left';
      chart.zoomControl.valign = 'bottom';

      const series = chart.series.push(new am4maps.MapImageSeries());
      const image = series.mapImages.template;
      image.nonScaling = true;
      image.propertyFields.latitude = 'latitude';
      image.propertyFields.longitude = 'longitude';
      // The text comes only from the pin's own `tooltip`, which deviceGeo.pinTooltip() built from
      // plain values with every [ ] { } ' doubled. No {placeholder} is ever evaluated, so an alias
      // such as "{udid}" or "[bold]" prints as typed.
      image.tooltipText = '';
      image.adapter.add('tooltipText', (text, target) => {
        const ctx = target.dataItem && target.dataItem.dataContext;
        return ctx && typeof ctx.tooltip === 'string' ? ctx.tooltip : text;
      });

      const circle = image.createChild(am4core.Circle);
      circle.radius = 6;
      circle.fill = am4core.color(PIN_FILL);
      circle.stroke = am4core.color('#ffffff');
      circle.strokeWidth = 1.5;
      circle.states.create('hover').properties.scale = 1.4;

      if (this.clickable) {
        image.cursorOverStyle = am4core.MouseCursorStyle.pointer;
        image.events.on('hit', (ev) => {
          const ctx = ev.target.dataItem && ev.target.dataItem.dataContext;
          if (ctx && ctx.udid) this.$emit('select', ctx.udid);
        });
      }

      this.chart = chart;
      this.series = series;
      chart.events.on('ready', () => this.zoomToPins(0));
      this.applyPins();
    },
    applyPins() {
      if (!this.chart || !this.series) return;
      // Plain copies: amCharts keeps references to its data objects.
      this.series.data = this.pins.map(p => ({ udid: p.udid, latitude: p.latitude, longitude: p.longitude, tooltip: p.tooltip }));
      if (this.chart.isReady()) this.zoomToPins(0);
    },
    zoomToPins(duration) {
      const chart = this.chart;
      const bounds = pinBounds(this.pins, this.clickable ? 4 : 2);
      if (!chart || !bounds) return;
      // Home (whole world) stays centred on the pins.
      chart.homeGeoPoint = bounds.center;
      chart.zoomToRectangle(bounds.north, bounds.east, bounds.south, bounds.west, 1, true, duration);
    },
  },
};
</script>

<style scoped>
.device-map {
  position: relative;
  width: 100%;
}
.device-map-chart {
  width: 100%;
  height: 100%;
}
.device-map-error {
  position: absolute;
  top: 0;
  left: 0;
}
</style>
