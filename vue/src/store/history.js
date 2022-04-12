export default {
    namespaced: true,
    state: {
        items: [
          /*
          
            auditlog: [
                {
                    "date": "2022-04-12T01:42:31.087Z",
                    "message": "OAuth2 User logged in...",
                    "flags": [
                        "info"
                    ]
                },
            ],
            buildlog: [
                
            ]
          
          */
        ],
        buildlog: [],
        auditlog: [],
        headers: [
          {
            title: 'name',
            prop: 'name',
            pos: 0,
          },
          {
            title: 'date',
            prop: 'date',
            pos: 1,
          },
          /*
          {
            title: 'fingerprint',
            prop: 'fingerprint',
            pos: 2,
          },
          
          {
            title: 'pubkey',
            prop: 'pubkey',
            pos: 3,
          },
          {
            title: 'filename',
            prop: 'filename',
            pos: 4,
          }
          */
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
      saveBuildItems(state, data) { 
        console.log('saveBuildItems', data);
        state.buildlog = data.items;
      },
      saveAuditItems(state, data) {
        console.log('saveAuditItems', data); 
        state.auditlog = data.items;
      }  
    },
    actions: {
        async fetchBuildLog({ state, commit, rootState }) {

            let accessToken = rootState.auth.accessToken;
            if (typeof rootState.auth.accessToken !== 'undefined') {
                accessToken = window.localStorage.getItem("accessToken");
            }

            const response = await fetch("/user/logs/build/list", {
                method: "GET",
                credentials: 'include',
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': 'Bearer ' + accessToken,
                    'Access-Control-Allow-Origin': 'http://localhost:3080',
                },
            });
            const { success, builds } = await response.json();
            if (success) {
                commit('saveBuildItems', { items: builds });
            }

            return state.items;

            //dispatch('fetchBuildlog');
            //dispatch('fetchAuditLog');
        },

        async fetchAuditlog({ state, commit, rootState }) {

            let accessToken = rootState.auth.accessToken;
            if (typeof rootState.auth.accessToken !== 'undefined') {
                accessToken = window.localStorage.getItem("accessToken");
            }

            const response = await fetch("/user/logs/audit", {
                method: "GET",
                credentials: 'include',
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': 'Bearer ' + accessToken,
                    'Access-Control-Allow-Origin': 'http://localhost:3080',
                },
            });
            const { success, auditlog } = await response.json();
            if (success) {
                commit('saveAuditItems', { items: auditlog });
            }

            return state.items;
        },
      },
      /*
      async fetchBuildLog({ state, commit, rootState }) {

        let accessToken = rootState.auth.accessToken;
        if (typeof rootState.auth.accessToken !== 'undefined') {
          accessToken = window.localStorage.getItem("accessToken");
        }

        const response = await fetch("/user/logs/build/list", {
            method: "GET",
            credentials: 'include',
            headers: {
                "Content-Type": "application/json",
                'Authorization': 'Bearer ' + accessToken,
                'Access-Control-Allow-Origin': 'http://localhost:3080',
            },
        });
        const { success, builds } = await response.json();
        
        if (success) {
            commit('saveBuildItems', { items: builds });
        }

        return state.items;
      },
      async fetchAuditLog({ state, commit, rootState }) {

        let accessToken = rootState.auth.accessToken;
        if (typeof rootState.auth.accessToken !== 'undefined') {
          accessToken = window.localStorage.getItem("accessToken");
        }

        const response = await fetch("/user/logs/audit", {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            'Authorization': 'Bearer ' + accessToken,
            'Access-Control-Allow-Origin': 'http://localhost:3080',
          },
        });
        const { success, logs } = await response.json();

        if (success) {
          commit('saveAuditItems', { items: logs });
        }

        return state.items;
      },
    },
    */
    getters: {
        getItems(state) {
            return {
                buildlog: state.buildlog,
                auditlog: state.auditlog,
            };
        },
        getHeaders(state) {
          return state.headers;
        }
    },
  };
