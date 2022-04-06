// TODO THiNX Fetch API Class

export default {
    data: () => {
      return {
        repos: [
            {
                id: 0
            },
        ]
      }
    },
    methods: {
      sources() {

        /*
        const requestOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Vue POST Request Example" })
        };
        fetch("https://jsonplaceholder.typicode.com/posts", requestOptions)
          .then(response => response.json())
          .then(data => (this.postId = data.id));
          */

          const requestOptions = {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer my-token',
              'My-Custom-Header': 'foobar'
            },
            body: JSON.stringify({ title: 'Vue POST Request Example' })
          };
          fetch('https://jsonplaceholder.typicode.com/posts', requestOptions)
            .then(response => response.json())
            .then(data => this.postId = data.id);

        return this.sources;
      },
    }
  };