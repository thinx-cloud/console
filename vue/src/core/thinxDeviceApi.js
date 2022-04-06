// TODO THiNX Fetch API Class

export default {
    data: () => {
      return {
        repositories: [
            {
                id: 0
            },
        ]
      }
    },
    methods: {
      async repositories() {

        const response = await fetch(urlBase + '/sources', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: this.$refs.username.value,
            password: this.$refs.password.value,
          }),
        });
        const { user, token } = await response.json();

        return this.repositories;
      },
    }
  };