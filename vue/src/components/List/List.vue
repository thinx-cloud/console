<template>
  <table class="table table-striped">
      <thead>
        <tr>
          <th>
            <div class="abc-checkbox">
              <input type="checkbox"
                id="checkbox1" :checked="checkboxes[0]"
                @change="event => checkAll(event, 'checkboxes')"
              />
              <label for="checkbox1" />
            </div>
          </th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Info</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="abc-checkbox">
              <input type="checkbox"
                id="checkbox2" :checked="checkboxes[1]"
                @change="event => changeCheck(event, 'checkboxes', 1)"
              />
              <label for="checkbox2" />
            </div>
          </td>
          <td>Mark</td>
          <td>Otto</td>
          <td><b-badge variant="success">Online</b-badge></td>
        </tr>
        <tr>
          <td>
            <div class="abc-checkbox">
              <input type="checkbox"
                id="checkbox3" :checked="checkboxes[2]"
                @change="event => changeCheck(event, 'checkboxes', 2)"
              />
              <label for="checkbox3" />
            </div>
          </td>
          <td>Jacob <b-badge variant="warning" class="text-gray-dark">ALERT!</b-badge></td>
          <td>Thornton</td>
          <td><b-badge variant="gray">Away</b-badge></td>
        </tr>
        <tr>
          <td>
            <div class="abc-checkbox">
              <input type="checkbox"
                id="checkbox4" :checked="checkboxes[3]"
                @change="event => changeCheck(event, 'checkboxes', 3)"
              />
              <label for="checkbox4" />
            </div>
          </td>
          <td>Larry</td>
          <td>the Bird</td>
          <td><b-badge variant="danger">Construct</b-badge></td>
        </tr>
      </tbody>
    </table>
</template>
<script>
import Vue from 'vue';

export default {
  name: 'List',
  props: {
    size: {type: Number, default: 21}
  },
  data() {
    return {
      checkboxes: [false, false, false, false],
    };
  },
  methods: {
    checkAll(ev, checkbox) {
      const checkboxArr = (new Array(this[checkbox].length)).fill(ev.target.checked);
      Vue.set(this, checkbox, checkboxArr);

      const isSelected = checkboxArr.some(function(e) { return e === true; });
      const totalCount = this.countOccurrences(checkboxArr, true);
      
      this.$emit('selection-update', { 
          state: isSelected, 
          count: totalCount == this[checkbox].length ? totalCount - 1 : totalCount // deduct selectAll checkbox
      });
    },
    changeCheck(ev, checkbox, id) {
      this[checkbox][id] = ev.target.checked;
      if (!ev.target.checked) {
        this[checkbox][0] = false;
      }
      this.$emit('selection-update', { 
          state: this.isSelected(), 
          count: this.countOccurrences(this.checkboxes, true) 
      });
    },
    isSelected() {
      return this.checkboxes.some(function(e) {
          return e === true;
      });
    },
    // TODO for count of selected
    countOccurrences(arr, val) {
        return arr.reduce((a, v) => (v === val ? a + 1 : a), 0);
    } 
  }
}
</script>

<style src="./List.scss" lang="scss"/>
