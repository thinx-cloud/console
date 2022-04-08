export default {
    state: {
        repositories: [],
        initialised: false,
    },
    mutations: {},
    actions: {
      async fetchRepositories({ state, commit, rootState }) {

        console.log('fetchRepositories', rootState.auth.accessToken);

        const response = await fetch("/user/sources/list", {
          method: "GET",
          //cors: false,
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            'Authorization': 'Bearer ' + rootState.auth.accessToken,
            'Access-Control-Allow-Origin': 'http://localhost:3080',
          },
        });
        const { success, sources } = await response.json();
        
        // {"success":true,"":{"7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f3":{"alias":"THiNX Vanilla ESP8266 Arduino","url":"git@github.com:suculent/thinx-firmware-esp8266-ino.git","branch":"origin/master","platform":"unknown"},"7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f4":{"alias":"THiNX Vanilla ESP8266 Platform.io","url":"git@github.com:suculent/thinx-firmware-esp8266-pio.git","branch":"origin/master","platform":"unknown_platform"},"7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f5":{"alias":"THiNX Vanilla ESP8266 LUA","url":"git@github.com:suculent/thinx-firmware-esp8266-lua.git","branch":"origin/master","platform":"nodemcu"},"7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f6":{"alias":"THiNX Vanilla ESP8266 Micropython","url":"git@github.com:suculent/thinx-firmware-esp8266-upy.git","branch":"origin/master","platform":"micropython"},"7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f7":{"alias":"THiNX Vanilla ESP8266 MongooseOS","url":"git@github.com:suculent/thinx-firmware-esp8266-mos.git","branch":"origin/master","platform":"mongoose"},"be53ad1498c6a8863be792ad606cec32177a2eca2228f98cdcd988acab5d3e60":{"alias":"thinx-kato-fong","url":"git@github.com:suculent/thinx-kato-fong.git","branch":"origin/master","platform":"nodejs","initial_platform":"nodejs"},"f707d51b667faafcab6b14ff7e4a61a03241993a66bd36330d8472c3dac977ac":{"alias":"mikulas-esp-lua-fw","url":"git@github.com:qool/thinx-firmware-esp8266-lua.git","branch":"origin/master","platform":"nodemcu","initial_platform":"nodemcu"},"eea4479aa1f411a1988f546fb1d1878c13d000420b3b2ea0d11c48d6adc068ee":{"alias":"test-git-repo","url":"https://github.com/suculent/thinx-device-api","branch":"origin/master","platform":"nodejs","initial_platform":"nodejs"},"6e55385f5110eb49437b3e04675d45dded78424b6e1dddc3c7d14ea0a8a9f2f8":{"alias":"test-git-repo-SourcesSpec.js","url":"https://github.com/suculent/thinx-device-api","branch":"origin/master","platform":"nodejs","initial_platform":"nodejs"},"ca698f9d7ccedcc3eaf9d240bfb39d433729f1c46dc026f3269879616b2f0bf4":{"alias":"test-source-alias","url":"git@github.com:suculent/thinx-firmware-esp8266.git","branch":"origin/master","platform":"platformio","initial_platform":"platformio"},"ee936045ac37fe85048f1fea6deba0894d199507fb87385548cc7e7bceb6691f":{"alias":"TD1208+Wemos","url":"https://github.com/suculent/thinx-example-battery-uart-wifi.git","branch":"origin/master","platform":"unknown_platform","initial_platform":"arduino"},"f8d02471c0d0011ab830cd98a8ff403b34ad546ae1d544cd331b683646fb32a8":{"owner":"cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12","alias":"thinx-firmware-esp32-pio","url":"git@github.com:suculent/thinx-firmware-esp32-pio.git","branch":"origin/master","initial_platform":"unknown"},"d495f182d045bb6f831dea28eb803d8710188d200788747d97d20e8877d74e38":{"owner":"cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12","alias":"piotest","url":"https://github.com/suculent/thinx-firmware-esp32-pio","branch":"origin/master","initial_platform":"platformio"},"320d9cfa1d6d7f46af9165ec145aa0ef876d5dbe80ed2988d5b3ed58d349af62":{"owner":"cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12","alias":"thinx-firmware-esp8266-ino","url":"git@github.com:suculent/thinx-firmware-esp8266-ino.git","branch":"origin/master","initial_platform":"unknown"},"eca6e3089a867f878c5981a982df70b18532d438d919908bba7f583145e9d78f":{"owner":"cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12","alias":"fixde-thinx-firmware-esp8266-ino","url":"git@github.com:suculent/thinx-firmware-esp8266-ino.git","branch":"origin/master","platform":"unknown_platform","initial_platform":"unknown_platform"},"ad0d8c65d6c62c3fc05c7149ad2ccd763d6ff5fbc645f54ac2192bad316c4583":{"owner":"cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12","alias":"Battery Example","url":"https://github.com/suculent/thinx-example-battery-uart-wifi.git","branch":"origin/master","platform":"arduino","initial_platform":"arduino"}}}

        if (success) {
          // TODO set uset
          state.repositories = sources;
        }
        return state.repositories;
      }
    },
    getters: {
        async getRepositories(state) {
          console.log('getRepositories');
          return state.repositories;
        }
    },
  };
