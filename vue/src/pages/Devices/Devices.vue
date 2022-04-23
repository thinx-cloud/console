<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">Devices</span>
    </h1>

    <p>
      <b-button variant="success" id="create-item" @click="create"
        >Add Mesh Channels</b-button
      >
      <b-button
        variant="danger"
        id="delete-selected-items"
        @click="deleteSelected"
        :disabled="!isSelected"
        >{{ selectedCount }}<span class="glyphicon glyphicon-trash"></span
      ></b-button>
    </p>

    <p>Manage your Devices</p>

    <List
      @selection-update="selectionUpdated"
      :datasource="items"
      :dataheaders="headers"
      :showLoading="loading"
    ></List>
  </div>
</template>

<script>
import List from '@/components/List/List';
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Devices",
  components: { List },
  data() {
    return {
      isSelected: false,
      selectedCount: 0,
      items: [],
      headers: [],
      loading: true,
      stats: undefined,
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData() }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'devices/getItems', getHeaders: 'devices/getHeaders', getStats: 'stats/getStats' }),
    ...mapActions({ fetchItems: 'devices/fetchItems', fetchStats: 'stats/fetchStats' }),
    create() {
      // TODO implement
    },
    deleteSelected() {
      // TODO implement
    },
    selectionUpdated(value) {
      this.isSelected = value.count > 0;
      this.selectedCount = value.count;
    },
    loadData() {
      this.loading = true;
      this.fetchItems().then((items) => {
        this.items = this.getItems();
        this.headers = this.getHeaders();
        this.loading = false;

        this.updateTimeline();

        this.fetchStats().then((stats) => {
          this.stats = this.getStats();
        });
      });
    },

    updateTimeline() {

      let devices = this.items;
      let deviceStats = {
        timeline: {
          MIN: 0,
          MAX:  0,
          COUNT: 0,
          SPAN: 0,
          ERRORS: 0,
          CHECKINS: 0,
        },
        total: {
          DEVICES: 0,
        }
      };

      var deviceTimeline = [];

      for ( var i in devices ) {
        devices[ i ].lastseen = this.$moment( devices[ i ].lastupdate ).fromNow( true );

        // iterate all device transformers and put them to meta container organised by utid
        /*
        if ( typeof( devices[ i ].transformers ) !== "undefined" && devices[ i ].transformers.length > 0 ) {
          for ( var transformerIndex in devices[ i ].transformers ) {
            var utid = devices[ i ].transformers[ transformerIndex ];
            if ( typeof( $rootScope.meta.transformerDevices[ utid ] ) === "undefined" ) {
              $rootScope.meta.transformerDevices[ utid ] = [];
            }
            $rootScope.meta.transformerDevices[ utid ].push( devices[ i ].udid );
          }
        }
        */

        // copy records to dashboard timeline
        deviceTimeline.push( {
          // TODO date: moment( devices[ i ].lastupdate ).format( "YYYY-MM-DD" ),
          alias: devices[ i ].alias,
          icon: devices[ i ].icon,
          udid: devices[ i ].udid,
          category: devices[ i ].category
        } );

        // generate list index of devices by attached apikey -> meta.apikeys
        /*
        if ( $rootScope.getApikeyByHash( devices[ i ].keyhash ) != false ) {
          if ( typeof( $rootScope.meta.apikeys[ devices[ i ].keyhash ] ) == "undefined" ) {
            $rootScope.meta.apikeys[ devices[ i ].keyhash ] = [];
          }
          $rootScope.meta.apikeys[ devices[ i ].keyhash ].push( devices[ i ] );
        }

        // generate list index of devices by attached source -> meta.sources
        if ( $rootScope.getSourceById( devices[ i ].source ) != false ) {
          if ( typeof( $rootScope.meta.sources[ devices[ i ].source ] ) == "undefined" ) {
            $rootScope.meta.sources[ devices[ i ].source ] = [];
          }
          $rootScope.meta.sources[ devices[ i ].source ].push( devices[ i ] );
        }
        */

      }
      deviceTimeline.sort( function( a, b ) {
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
        return new Date( b.date ) - new Date( a.date );
      } );
      console.log( "//////// deviceTimeline" );

      deviceStats.timeline.MIN = deviceTimeline[ 0 ][ "date" ];
      deviceStats.timeline.MAX = deviceTimeline[ deviceTimeline.length - 1 ][ "date" ];
      deviceStats.timeline.COUNT = deviceTimeline.length - 1;
      deviceStats.timeline.SPAN = this.$moment( deviceStats.timeline.MAX ).diff( this.$moment( deviceStats.timeline.MIN ), "days" );
      deviceStats.timeline.ERRORS = [];
      deviceStats.timeline.CHECKINS = deviceTimeline;

      deviceStats.total.DEVICES = devices.length;

    },

    updateCharts() {

        $( "#sparkline_bar" ).sparkline( $rootScope.stats.daily.DEVICE_CHECKIN, {
          type: "bar",
          width: "80",
          barWidth: 8,
          height: "55",
          barColor: "#29b4b6",
          negBarColor: "#29b4b6"
        } );

        console.log( "dailystats", $rootScope.stats.daily.DEVICE_NEW );
        $( "#sparkline_bar2" ).sparkline( $rootScope.stats.daily.DEVICE_NEW, {
          type: "bar",
          width: "80",
          barWidth: 8,
          height: "55",
          barColor: "#1ba39c",
          negBarColor: "#1ba39c"
        } );

        $( "#sparkline_inchart_active" ).sparkline( $rootScope.stats.daily.DEVICE_ACTIVE, {
          type: "bar",
          width: "190",
          barWidth: 26,
          height: "55",
          barColor: "#ffffff",
          negBarColor: "#ffffff"
        } );

        $( "#sparkline_inchart_checkin" ).sparkline( $rootScope.stats.daily.DEVICE_CHECKIN, {
          type: "bar",
          width: "190",
          barWidth: 26,
          height: "55",
          barColor: "#ffffff",
          negBarColor: "#ffffff",
          zeroAxis: false,
          tooltipFormat: "Daily - {{value}}"
        } );

        $( "#sparkline_inchart_error" ).sparkline( $rootScope.stats.daily.DEVICE_ERROR, {
          type: "bar",
          width: "80",
          barWidth: 8,
          height: "55",
          barColor: "#ffffff",
          negBarColor: "#ffffff"
        } );

        $( "#sparkline_inchart_update" ).sparkline( $rootScope.stats.daily.DEVICE_UPDATE, {
          type: "bar",
          width: "80",
          barWidth: 8,
          height: "55",
          barColor: "#ffffff",
          negBarColor: "#ffffff"
        } );

    }

  },
};
</script>