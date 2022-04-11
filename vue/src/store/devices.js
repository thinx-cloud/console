export default {
    namespaced: true,
    state: {
        items: [
          /*
            {
                "alias": "esp32",
                "auto_update": false,
                "category": "grey-mint",
                "checksum": null,
                "commit": "unknown",
                "description": "new device",
                "environment": {},
                "firmware": "thinx-lib-esp32-arduino:2.3.180",
                "icon": "01",
                "keyhash": "81b4b0b31d2f1efa3c6d7ae2dea701af4a3d28f7f97ce82818d30c39b4438e6b",
                "lastupdate": "2020-04-21T16:15:42.440Z",
                "lat": "0.00",
                "lon": "0.00",
                "mac": "5C:CF:7F:2C:40:A2",
                "mesh_ids": [],
                "owner": "cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12",
                "platform": "arduino",
                "rssi": "-54",
                "snr": null,
                "source": "7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f3",
                "station": null,
                "status": "Registered",
                "tags": [],
                "transformers": [],
                "udid": "facbc110-6108-11e8-ac2f-05fc63c7a9bf",
                "version": "2.3.180"
            }
          */
        ],
        headers: [
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          },
          {
            title: 'mac',
            prop: 'mac',
            pos: 1,
          },
        ]
    },
    mutations: {
      saveItems(state, data) { 
        let flatItems = [];
        for (let id of Object.keys(data.items)) {
          flatItems.push({id: id, ...data.items[id]});
        }
        state.items = flatItems;
      },
      saveDevices(state, data) { 

        console.log('debuggggg', data);
        let flatItems = [];
        for (let item of data.items) {
          flatItems.push(item);
        }
        console.log('flatItems', flatItems);
        state.items = flatItems;
      }
    },
    actions: {
      async fetchItems({ state, commit, rootState }) {

        let accessToken = rootState.auth.accessToken;
        if (typeof rootState.auth.accessToken !== 'undefined') {
          accessToken = window.localStorage.getItem("accessToken");
        }
        
        const response = await fetch("/user/devices", {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            'Authorization': 'Bearer ' + accessToken,
            'Access-Control-Allow-Origin': 'http://localhost:3080',
          },
        });
        const { success, devices } = await response.json();
        
        if (success) {
          commit('saveDevices', { items: devices });
        }
        return state.items;
      },
    },
    getters: {
        getItems(state) {
          return state.items;
        },
        getHeaders(state) {
          return state.headers;
        }
    },
  };
