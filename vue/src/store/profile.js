
export default {
    namespaced: true,
    state: {
        profile: {},
          /*
          
          {
    "success": true,
    "profile": {
        "first_name": "Jenkina",
        "last_name": "Teacloud",
        "username": "test",
        "owner": "cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12",
        "avatar": "",
        "info": {
            "first_name": "Jenkina",
            "last_name": "Teacloud",
            "mobile_phone": "+420603861240",
            "goals": [
                "apikey",
                "enroll",
                "enroll-setup",
                "source",
                "rsakey",
                "build",
                "help-update",
                "deploykey",
                "history-info"
            ],
            "security": {
                "important_notifications": true
            },
            "tags": [
                "test",
                "eav",
                "czech",
                "tag",
                "icon-01"
            ],
            "transformers": [
                {
                    "utid": "1",
                    "alias": "Pass-Through",
                    "body": "Ly8gTWluaW1hbCBgbm8tb3BgIFRyYW5zZm9ybWVyIChhbHdheXMgc3RhcnQgd2l0aCBjb21tZW50ISkKCnZhciB0cmFuc2Zvcm1lciA9IGZ1bmN0aW9uKHN0YXR1cywgZGV2aWNlKSB7CiAgICByZXR1cm4gc3RhdHVzOyAKfTs="
                },
                {
                    "utid": "2",
                    "alias": "SimpleCell",
                    "body": "Ly8gU2ltcGxlQ2VsbAp2YXIgdHJhbnNmb3JtZXIgPSBmdW5jdGlvbihzdGF0dXMsIGRldmljZSkgeyAKICBpZiAoc3RhdHVzLnRvU3RyaW5nKCkgPT0gIjUyIikgewogICAgcmV0dXJuICgiRGV2aWNlIG1vdmVkICgiICsgbmV3IERhdGUoKS50b1N0cmluZygpICsgIikiKTsKICB9IGVsc2UgaWYgKHN0YXR1cy50b1N0cmluZygpID09ICIzMiIpIHsKICAgIHJldHVybiAoIkJ1dHRvbiBwcmVzc2VkICgiICsgbmV3IERhdGUoKS50b1N0cmluZygpICsgIikiKTsKICB9IGVsc2UgewogICAgcmV0dXJuIHN0YXR1cy50b1N0cmluZygpOwogIH0KfTs="
                },
                {
                    "utid": "89889b2ae61a398330e7a50338f5d7aa98c9a807809e6fc8cba8b3fa89494a8d",
                    "alias": "Battery (new)",
                    "body": "Ly8KLy8gU2FtcGxlIHRhZyAmIGJ5dGUvZmxvYXQgVHJhbnNmb3JtZXIKLy8gRXhwZWN0ZWQgdmFsdWUgaXMgMHhiYVhYWFhYWFhYIHdoZXJlIFhYWFhYWFhYIGFyZSA0IGJ5dGVzIGZsb2F0IGJhdHRlcnkgdm9sdGFnZQovLyAoWW91IG1heSBkZWNpZGUgb24geW91ciBvd24gdGFnIGxlbmd0aCBvciBzdHJ1Y3R1cmUsIHRoaXMgaXMganVzdCBhbiBleGFtcGxlLikKLy8KCnZhciB0cmFuc2Zvcm1lciA9IGZ1bmN0aW9uKHN0YXR1cywgZGV2aWNlKSB7CgogICAgLy8KICAgIC8vIENvbnZlbmllbmNlIGZ1bmN0aW9ucwogICAgLy8KCiAgICAvLyBDb252ZXJ0cyBiZXR3ZWVuIGVuZGlhbnMJCQkKICAgIHZhciBmbGlwSGV4U3RyaW5nID0gZnVuY3Rpb24oaGV4VmFsdWUsIGhleERpZ2l0cykgewogICAgICB2YXIgaCA9IGhleFZhbHVlLnN1YnN0cigwLCAyKTsKICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoZXhEaWdpdHM7ICsraSkgewogICAgICAgIGggKz0gaGV4VmFsdWUuc3Vic3RyKDIgKyAoaGV4RGlnaXRzIC0gMSAtIGkpICogMiwgMik7CiAgICAgIH0KICAgICAgcmV0dXJuIGg7CiAgICB9OwoKICAgIC8vIENvbnZlcnRzIGhleGFkZWNpbWFsIHZhbHVlIHRvIGZsb2F0CiAgICB2YXIgaGV4VG9GbG9hdCA9IGZ1bmN0aW9uKGhleCkgewogICAgICB2YXIgcyA9IGhleCA+PiAzMSA/IC0xIDogMTsKICAgICAgdmFyIGUgPSAoaGV4ID4+IDIzKSAmIDB4RkY7CiAgICAgIHJldHVybiBzICogKGhleCAmIDB4N2ZmZmZmIHwgMHg4MDAwMDApICogMS4wIC8gTWF0aC5wb3coMiwgMjMpICogTWF0aC5wb3coMiwgKGUgLSAxMjcpKTsKICAgIH07CiAgCiAgICAvLyBDaGVjayB0aGUgcHJlZml4IGZvciAnYmEnCiAgICBjb25zdCB0YWcgPSBzdGF0dXMuc3Vic3RyKDAsIDIpOyAvLyBzdGFydCwgbGVuZ3RoCiAgICB2YXIgaWNvbiA9ICIiOwogICAgaWYgKHRhZyA9PSAiYmEiKSB7CiAgICAgIGNvbnN0IGhleF92b2x0YWdlID0gc3RhdHVzLnN1YnN0cigyLCBzdGF0dXMubGVuZ3RoIC0gMik7CQkJCQkJCiAgICAgIGNvbnN0IHZvbHRhZ2UgPSBoZXhUb0Zsb2F0KGZsaXBIZXhTdHJpbmcoIjB4IiArIGhleF92b2x0YWdlLCA4KSk7CiAgICAgIGlmICh2b2x0YWdlIDwgMy4wKSB7IAogICAgICAgIGljb24gPSAiI2UiOyAvLyBzaG93IHJlZCBlcnJvciBzaWduIHdoZW4gYmF0dGVyeSBpcyBlbXB0eQogICAgICB9IGVsc2UgaWYgKHZvbHRhZ2UgPiAzLjAgJiYgdm9sdGFnZSA8IDMuNCkgeyAKICAgICAgICBpY29uID0gIiN3IjsgLy8gc2hvdyB5ZWxsb3cgd2FybmluZyBzaWduIHdoZW4gYmF0dGVyeSBpcyBiZWxsb3cgc3BlY2lmaWVkIGxldmVsCiAgICAgIH0KICAgICAgcmV0dXJuICJCYXR0ZXJ5ICIgKyB2b2x0YWdlLnRvRml4ZWQoMykgKyAiIFYiICsgaWNvbjsKICAgIH0gZWxzZSB7IAogICAgICByZXR1cm4gc3RhdHVzOyAvLyBpbiBjYXNlIHJldHVybiB2YWx1ZSBpcyB1bmRlZmluZWQsIG9yaWdpbmFsIHN0YXR1cyB3aWxsIGJlIGRpc3BsYXllZAogICAgfQp9Ow=="
                },
                {
                    "utid": "f96f0d8da6c4891ed1ebc2e573e777e46f183b9e36532afa277834b05edb1d6c",
                    "alias": "SigFox (new)",
                    "body": "Ly8KLy8gU2FtcGxlIHRhZyAmIGJ5dGUvZmxvYXQgVHJhbnNmb3JtZXIKLy8gRXhwZWN0ZWQgdmFsdWUgaXMgMHhiYVhYWFhYWFhYIHdoZXJlIFhYWFhYWFhYIGFyZSA0IGJ5dGVzIGZsb2F0IGJhdHRlcnkgdm9sdGFnZQovLyAoWW91IG1heSBkZWNpZGUgb24geW91ciBvd24gdGFnIGxlbmd0aCBvciBzdHJ1Y3R1cmUsIHRoaXMgaXMganVzdCBhbiBleGFtcGxlLikKLy8KCnZhciB0cmFuc2Zvcm1lciA9IGZ1bmN0aW9uKHN0YXR1cywgZGV2aWNlKSB7CgogICAgLy8KICAgIC8vIENvbnZlbmllbmNlIGZ1bmN0aW9ucwogICAgLy8KCiAgICAvLyBDb252ZXJ0cyBiZXR3ZWVuIGVuZGlhbnMJCQkKICAgIHZhciBmbGlwSGV4U3RyaW5nID0gZnVuY3Rpb24oaGV4VmFsdWUsIGhleERpZ2l0cykgewogICAgICB2YXIgaCA9IGhleFZhbHVlLnN1YnN0cigwLCAyKTsKICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoZXhEaWdpdHM7ICsraSkgewogICAgICAgIGggKz0gaGV4VmFsdWUuc3Vic3RyKDIgKyAoaGV4RGlnaXRzIC0gMSAtIGkpICogMiwgMik7CiAgICAgIH0KICAgICAgcmV0dXJuIGg7CiAgICB9OwoKICAgIC8vIENvbnZlcnRzIGhleGFkZWNpbWFsIHZhbHVlIHRvIGZsb2F0CiAgICB2YXIgaGV4VG9GbG9hdCA9IGZ1bmN0aW9uKGhleCkgewogICAgICB2YXIgcyA9IGhleCA+PiAzMSA/IC0xIDogMTsKICAgICAgdmFyIGUgPSAoaGV4ID4+IDIzKSAmIDB4RkY7CiAgICAgIHJldHVybiBzICogKGhleCAmIDB4N2ZmZmZmIHwgMHg4MDAwMDApICogMS4wIC8gTWF0aC5wb3coMiwgMjMpICogTWF0aC5wb3coMiwgKGUgLSAxMjcpKTsKICAgIH07CiAgCiAgICAvLyBDaGVjayB0aGUgcHJlZml4IGZvciAnYmEnCiAgICBjb25zdCB0YWcgPSBzdGF0dXMuc3Vic3RyKDAsIDIpOyAvLyBzdGFydCwgbGVuZ3RoCiAgICB2YXIgaWNvbiA9ICIiOwogICAgaWYgKHRhZyA9PSAiYmEiKSB7CiAgICAgIGNvbnN0IGhleF92b2x0YWdlID0gc3RhdHVzLnN1YnN0cigyLCBzdGF0dXMubGVuZ3RoIC0gMik7CQkJCQkJCiAgICAgIGNvbnN0IHZvbHRhZ2UgPSBoZXhUb0Zsb2F0KGZsaXBIZXhTdHJpbmcoIjB4IiArIGhleF92b2x0YWdlLCA4KSk7CiAgICAgIGlmICh2b2x0YWdlIDwgMy4wKSB7IAogICAgICAgIGljb24gPSAiI2UiOyAvLyBzaG93IHJlZCBlcnJvciBzaWduIHdoZW4gYmF0dGVyeSBpcyBlbXB0eQogICAgICB9IGVsc2UgaWYgKHZvbHRhZ2UgPiAzLjAgJiYgdm9sdGFnZSA8IDMuNCkgeyAKICAgICAgICBpY29uID0gIiN3IjsgLy8gc2hvdyB5ZWxsb3cgd2FybmluZyBzaWduIHdoZW4gYmF0dGVyeSBpcyBiZWxsb3cgc3BlY2lmaWVkIGxldmVsCiAgICAgIH0KICAgICAgcmV0dXJuICJCYXR0ZXJ5ICIgKyB2b2x0YWdlLnRvRml4ZWQoMykgKyAiIFYiICsgaWNvbjsKICAgIH0gZWxzZSB7IAogICAgICByZXR1cm4gc3RhdHVzOyAvLyBpbiBjYXNlIHJldHVybiB2YWx1ZSBpcyB1bmRlZmluZWQsIG9yaWdpbmFsIHN0YXR1cyB3aWxsIGJlIGRpc3BsYXllZAogICAgfQoKICAgIAp9Ow=="
                }
            ],
            "notifications": {
                "all": false,
                "important": false,
                "info": false
            },
            "email": "thinx.cloud@gmail.com",
            "test_avatar": "AABJRU5ErkJggg==",
            "username": "test",
            "owner": "cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12"
        },
        "admin": true
    }
}
              
          */
    },
    mutations: {
      saveProfile(state, data) { 
        state.profile = data;
      }
    },
    actions: {
      async fetchProfile({ state, commit }) {
        const result = await this.$api.$get('/profile');
        if (result.success) {
          commit('saveProfile', { items: result.response });
        }
        return state.profile;
      },
    },
    getters: {
        getProfile(state) {
          return state.profile;
        }
    },
  };
