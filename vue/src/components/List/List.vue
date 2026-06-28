<template>
  <div v-if="showLoading" class="loading-indicator">Loading...</div>
  <table v-else class="table table-striped">
    <thead>
      <tr>
        <th>
          <div class="abc-checkbox">
            <input
              type="checkbox"
              id="checkboxX"
              :checked="isAllSelected"
              @change="(event) => checkAll(event)"
            />
            <label for="checkboxX" />
          </div>
        </th>
        <th v-for="header in filteredHeaders" :key="header.prop">
          {{ header.title }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(item, index) in datasource" :key="item.id">
        <td>
          <div class="abc-checkbox">
            <input
              type="checkbox"
              :id="'checkbox' + index"
              :checked="isItemSelected(item.id)"
              @change="(event) => changeCheck(event, item.id)"
            />
            <label :for="'checkbox' + index" />
          </div>
        </td>
        <td v-for="header in filteredHeaders" :key="header.prop">
          {{ item[header.prop] }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
<script>
import Vue from "vue";

export default {
  name: "List",
  props: {
    size: { type: Number, default: 21 },
    datasource: { type: Array, default: [] },
    dataheaders: { type: Array, default: [] },
    showLoading: { type: Boolean, default: true },
  },
  data() {
    return {
      selectedItems: [],
    };
  },
  computed: {
    filteredHeaders() {
      return this.dataheaders.filter((h) => h.pos !== null);
    },
    isAllSelected() {
      // All rows selected only when every row is in selectedItems. Guard against an
      // empty datasource so the header checkbox isn't shown checked with zero rows.
      return this.datasource.length > 0 && this.selectedItems.length === this.datasource.length;
    },
  },
  methods: {
    checkAll(ev) {
      let selectedItems = [];
      if (ev.target.checked) {
        selectedItems = this.datasource.map((item) => item.id);
      }
      Vue.set(this, "selectedItems", selectedItems);
      this.$emit("selection-update", {
        count: this.selectedItems.length,
        items: this.selectedItems,
      });
    },
    changeCheck(ev, id) {
      const index = this.selectedItems.indexOf(id);
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      } else {
        this.selectedItems.push(id);
      }
      this.$emit("selection-update", {
        count: this.selectedItems.length,
        items: this.selectedItems,
      });
    },
    isItemSelected(id) {
      return this.selectedItems.indexOf(id) > -1;
    },
    // TODO for count of selected
    countOccurrences(arr, val) {
      return arr.reduce((a, v) => (v === val ? a + 1 : a), 0);
    },
  },
};
</script>

<style src="./List.scss" lang="scss" />
