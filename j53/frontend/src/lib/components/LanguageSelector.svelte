<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let current: string;

  const dispatch = createEventDispatcher();

  const languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'plaintext', label: '纯文本' }
  ];

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    dispatch('change', target.value);
  }
</script>

<div class="language-selector">
  <label for="language" class="language-label">语言:</label>
  <select id="language" value={current} on:change={handleChange} class="language-select">
    {#each languages as lang}
      <option value={lang.value} selected={lang.value === current}>
        {lang.label}
      </option>
    {/each}
  </select>
</div>

<style scoped>
  .language-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .language-label {
    font-size: 13px;
    color: #ccc;
  }

  .language-select {
    padding: 6px 12px;
    background-color: #3c3c3c;
    color: #d4d4d4;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    outline: none;
  }

  .language-select:hover {
    background-color: #454545;
  }

  .language-select:focus {
    border-color: #0e639c;
  }

  .language-select option {
    background-color: #252526;
    color: #d4d4d4;
  }
</style>
