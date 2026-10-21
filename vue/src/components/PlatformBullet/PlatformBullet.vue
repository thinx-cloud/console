<template>
  <span class="platform-bullet" :class="'platform-' + info.key">{{ info.label }}</span>
</template>

<script>
// Shared platform bullet (phase 44, DEV-04, REPO-01, UI-D03). Renders the fixed
// display label of the base platform, never the raw platform string. Colours come
// from src/styles/_platforms.scss (.platform-bullet, .platform-<key>).
import { platformInfo } from '@/utils/platforms';

export default {
  name: 'PlatformBullet',
  props: {
    platform: { type: String, default: '' },
  },
  computed: {
    info() {
      return platformInfo(this.platform);
    },
  },
};
</script>
