<template>
  <span class="icon-button" :title="label">
    <b-button size="sm" :variant="variant" :aria-label="label" :disabled="disabled" v-bind="$attrs" @click="onClick">
      <i :class="icon" aria-hidden="true"></i>
      <span class="icon-button__text d-none d-lg-inline">{{ label }}</span>
    </b-button>
  </span>
</template>

<script>
// Shared icon button (phase 44, DEV-03, UI-D06..UI-D08), reused by Phases 45-47.
// The label is the one source of the visible text (from 992px), the aria-label and
// the hover tip. The tip sits on the wrapper span because Bootstrap's disabled
// buttons have pointer-events: none and would swallow it (UI-D07). With
// inheritAttrs off, parent attributes such as data-cy land on the button itself.
// Styles live in src/styles/_platforms.scss (.icon-button).
export default {
  name: 'IconButton',
  inheritAttrs: false,
  props: {
    icon: { type: String, required: true },
    label: { type: String, required: true },
    variant: { type: String, default: 'default' },
    disabled: { type: Boolean, default: false },
  },
  methods: {
    onClick(event) {
      if (this.disabled) return;
      this.$emit('click', event);
    },
  },
};
</script>
