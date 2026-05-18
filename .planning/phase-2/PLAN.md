---
phase: 2
plan: 1
type: implementation
wave: 1
depends_on: []
files_modified:
  - vue/src/pages/Repositories/Repositories.vue
  - vue/src/store/repositories.js
  - vue/src/pages/Apikeys/Apikeys.vue
  - vue/src/pages/Rsakeys/Rsakeys.vue
autonomous: false
requirements:
  - REPO-03
  - REPO-05
  - AKEY-02
  - RKEY-02

must_haves:
  truths:
    - "Submitting a duplicate repository alias shows an inline error and does not call the API"
    - "Repository device-count column situation is resolved: either shown or explicitly documented as a backend gap"
    - "API Key result modal has a working Copy button that writes the key to the clipboard"
    - "RSA Key result modal has a working Copy button that writes the public key to the clipboard"
  artifacts:
    - path: "vue/src/pages/Repositories/Repositories.vue"
      provides: "Duplicate alias guard in create() and device-count column (or gap note)"
    - path: "vue/src/pages/Apikeys/Apikeys.vue"
      provides: "Copy-to-clipboard button in apikey-result-modal"
    - path: "vue/src/pages/Rsakeys/Rsakeys.vue"
      provides: "Copy-to-clipboard button in rsakey-result-modal"
  key_links:
    - from: "create() method"
      to: "this.items array"
      via: "Array.prototype.find on alias field"
      pattern: "items\\.find.*alias"
    - from: "Copy button"
      to: "navigator.clipboard"
      via: "writeText() with textarea fallback"
      pattern: "navigator\\.clipboard\\.writeText"
---

<objective>
Gap-fill Phase 2 of the THiNX Vue console migration.

All five management pages (API Keys, Repositories, RSA Keys, Enviros, Channels) already have working
create and delete flows with real API calls. This plan closes the three remaining gaps:

1. Repositories: prevent duplicate alias submission without an API round-trip (REPO-03).
2. Repositories: resolve device-count-per-row requirement — investigate API shape and either add
   the column or document it as a backend gap (REPO-05).
3. API Keys and RSA Keys: add a clipboard copy button to the one-time key display modals
   (AKEY-02, RKEY-02).

Purpose: Complete Phase 2 so every listed CRUD requirement is either implemented or explicitly
triaged as blocked on the backend, leaving no silent gaps.

Output: Modified Repositories.vue with alias guard, modified Apikeys.vue and Rsakeys.vue with
copy buttons, and (if REPO-05 is a backend gap) an inline code comment documenting the finding.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phase-2/RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Duplicate alias guard in Repositories create() (REPO-03)</name>
  <files>vue/src/pages/Repositories/Repositories.vue</files>
  <action>
    Open vue/src/pages/Repositories/Repositories.vue. The create() method starts at line 96.

    Make the following two changes:

    1. At the very start of create() — before the existing empty-check on line 98 — add a line
       that clears any previous error:
         this.error = null;

    2. After the existing empty-check (after line 98), add a duplicate-alias guard:
         const duplicate = this.items.find(r => r.alias === this.form.alias.trim());
         if (duplicate) {
           this.error = 'A repository with this alias already exists.';
           return;
         }

    Also add a b-alert inside the create-repo-modal so the error is visible while the modal is
    still open (the existing b-alert at line 21 is in the page body behind the modal and not
    visible when the modal is open). Locate the create-repo-modal template and add before the
    first b-form-group:
      &lt;b-alert :show="!!error" variant="danger" class="mb-3"&gt;{{ error }}&lt;/b-alert&gt;

    The final create() method preamble should read:
      async create(bvModalEvt) {
        bvModalEvt.preventDefault();
        this.error = null;
        if (!this.form.url.trim() || !this.form.alias.trim()) return;
        const duplicate = this.items.find(r => r.alias === this.form.alias.trim());
        if (duplicate) {
          this.error = 'A repository with this alias already exists.';
          return;
        }
        // ... rest of create() method unchanged — do not replace the whole method with this snippet
  </action>
  <verify>
    <automated>grep -n "this.items.find" vue/src/pages/Repositories/Repositories.vue</automated>
    Manual: Open /repositories in the dev server. Add a repo. Try adding another with the same
    alias. The modal should stay open and show "A repository with this alias already exists."
    in a red alert inside the modal. No network request should fire (confirm in DevTools Network
    tab — no PUT /source on the duplicate attempt).
  </verify>
  <done>
    Submitting the create form with an alias already present in this.items shows the inline error
    alert and returns early without calling createItem(). Submitting a genuinely new alias proceeds
    normally. this.error is cleared at the start of each create() call.
  </done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 2: Investigate and resolve device count per repository row (REPO-05)</name>
  <files>vue/src/store/repositories.js</files>
  <action>
    Read vue/src/store/repositories.js. The saveItems mutation (lines 45-51) flattens the API
    response object from GET /source. The schema comment at lines 6-14 shows the fields returned
    per repository: id, alias, url, branch, platform.

    There is NO device count field in the GET /source response as observed in the existing code.

    Decision required: determine whether the backend exposes a device count anywhere reachable
    from this page. Two sub-steps:

    A) Check the live API. In the browser dev tools (or via curl with a valid auth token), call
       GET /source and inspect the full response JSON for any field resembling a device count
       (e.g. "devices", "device_count", "associated_devices").

    B) If a device count field exists in the response but is just not mapped: add a header entry
       to the headers array in repositories.js:
         { title: 'devices', prop: '<actual_field_name>', pos: 3 }
       No other change needed — the List component renders all headers with a non-null pos.

    C) If no device count field exists in the response: add a one-line comment above the headers
       array in repositories.js:
         // REPO-05: GET /source does not return a device count. Backend change required before
         // this column can be added. Tracked as backend gap.
       Do not add a placeholder column. Do not show a static "0" or "N/A" column.
  </action>
  <how-to-verify>
    Check GET /source in your browser's Network tab while on the Repositories page (or run:
      curl -s -H "Authorization: Bearer $TOKEN" $API_BASE/source | python3 -m json.tool
    ).

    If you see a device count field: confirm the column appears in the Repositories table after
    adding the header entry.

    If you do not see a device count field: confirm the gap comment is present in repositories.js
    and no spurious column appears in the table.
  </how-to-verify>
  <resume-signal>
    Type "column added: &lt;field_name&gt;" if a device count field was found and wired, or
    "backend gap confirmed" if the field does not exist in the response.
  </resume-signal>
</task>

<task type="auto">
  <name>Task 3: Copy-to-clipboard button in one-time key modals (AKEY-02, RKEY-02)</name>
  <files>
    vue/src/pages/Apikeys/Apikeys.vue
    vue/src/pages/Rsakeys/Rsakeys.vue
  </files>
  <action>
    Add a "Copy to clipboard" button to each one-time display modal. Use the same pattern in
    both files.

    --- Apikeys.vue ---

    The modal "apikey-result-modal" currently contains (lines 38-42):
      &lt;b-modal id="apikey-result-modal" title="API Key Created" ok-only ok-title="Close"&gt;
        &lt;p&gt;Your new API key has been created. Copy it now — it will not be shown again.&lt;/p&gt;
        &lt;b-form-input readonly :value="createdKey" /&gt;
      &lt;/b-modal&gt;

    Replace it with:
      &lt;b-modal id="apikey-result-modal" title="API Key Created" ok-only ok-title="Close"&gt;
        &lt;p&gt;Your new API key has been created. Copy it now — it will not be shown again.&lt;/p&gt;
        &lt;b-form-input readonly :value="createdKey" class="mb-2" /&gt;
        &lt;b-button variant="outline-secondary" size="sm" @click="copyToClipboard(createdKey)"&gt;
          Copy to clipboard
        &lt;/b-button&gt;
      &lt;/b-modal&gt;

    Add a copyToClipboard(value) method to the methods object in the script section:
      copyToClipboard(value) {
        navigator.clipboard.writeText(value).catch(() => {
          const el = document.createElement('textarea');
          el.value = value;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        });
        this.$toasted.show('Copied to clipboard', { type: 'success', duration: 2000 });
      },

    --- Rsakeys.vue ---

    The modal "rsakey-result-modal" currently contains (lines 35-40):
      &lt;b-modal id="rsakey-result-modal" title="RSA Key Generated" ok-only ok-title="Close"&gt;
        &lt;p&gt;Your new RSA key pair has been generated. Add the public key below to your Git
           repository's deploy keys.&lt;/p&gt;
        &lt;b-form-group label="Public Key"&gt;
          &lt;b-form-textarea readonly :value="createdPubkey" rows="4" /&gt;
        &lt;/b-form-group&gt;
      &lt;/b-modal&gt;

    Replace it with:
      &lt;b-modal id="rsakey-result-modal" title="RSA Key Generated" ok-only ok-title="Close"&gt;
        &lt;p&gt;Your new RSA key pair has been generated. Add the public key below to your Git
           repository's deploy keys.&lt;/p&gt;
        &lt;b-form-group label="Public Key"&gt;
          &lt;b-form-textarea readonly :value="createdPubkey" rows="4" class="mb-2" /&gt;
          &lt;b-button variant="outline-secondary" size="sm" @click="copyToClipboard(createdPubkey)"&gt;
            Copy to clipboard
          &lt;/b-button&gt;
        &lt;/b-form-group&gt;
      &lt;/b-modal&gt;

    Add the same copyToClipboard(value) method to Rsakeys.vue's methods object (identical
    implementation — vue-toasted is registered globally as this.$toasted in main.js).

    Do not import any additional library. navigator.clipboard is available in all modern browsers;
    the textarea fallback covers older environments.
  </action>
  <verify>
    <automated>grep -n "copyToClipboard" vue/src/pages/Apikeys/Apikeys.vue vue/src/pages/Rsakeys/Rsakeys.vue</automated>
    Manual: In the dev server, create an API key. When the result modal appears, click "Copy to
    clipboard". Paste into a text editor — the key value should be present. A green "Copied to
    clipboard" toast should appear and auto-dismiss after 2 seconds.

    Repeat for RSA key: generate a key, open the result modal, click copy, paste into a text
    editor to confirm the full public key text was copied.
  </verify>
  <done>
    Both one-time modals display a "Copy to clipboard" button beneath the key/textarea. Clicking
    the button writes the value to the system clipboard via navigator.clipboard (with textarea
    fallback) and shows a vue-toasted success toast (this.$toasted) that auto-hides after 2 seconds.
    No external library is added beyond vue-toasted which is already registered in main.js.
  </done>
</task>

</tasks>

<verification>
After all three tasks are complete:

1. Duplicate alias guard:
   - grep -n "items.find" vue/src/pages/Repositories/Repositories.vue returns a match inside create()
   - grep -n "this.error = null" vue/src/pages/Repositories/Repositories.vue shows the clear at the
     start of create()

2. Device count (REPO-05):
   - Either grep -n "devices" vue/src/store/repositories.js shows a header entry with pos >= 0,
     OR grep -n "REPO-05" vue/src/store/repositories.js shows the gap comment.

3. Copy buttons:
   - grep -c "copyToClipboard" vue/src/pages/Apikeys/Apikeys.vue returns 2 (template ref + method)
   - grep -c "copyToClipboard" vue/src/pages/Rsakeys/Rsakeys.vue returns 2 (template ref + method)

4. Build passes:
   - cd vue && npm run build exits 0 (no compile errors introduced)
</verification>

<success_criteria>
- REPO-03: Submitting a duplicate alias in the repository create modal shows an inline error and
  makes no API call. Verified manually via DevTools Network tab.
- REPO-05: Device count column added with real field name, OR gap comment present in
  repositories.js and human checkpoint resolved as "backend gap confirmed".
- AKEY-02: API key result modal has a working Copy button. Key pastes correctly from clipboard.
  Success toast appears and auto-hides.
- RKEY-02: RSA key result modal has a working Copy button. Full public key pastes correctly.
  Success toast appears and auto-hides.
- npm run build (inside vue/) exits 0.
</success_criteria>

<output>
Create `.planning/phase-2/SUMMARY.md` when done.
</output>
