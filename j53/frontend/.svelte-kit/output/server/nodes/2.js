

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.DpQOZaDO.js","_app/immutable/chunks/BY5Bqgln.js","_app/immutable/chunks/BVnhoIqq.js"];
export const stylesheets = ["_app/immutable/assets/2.C-ejW4Ad.css"];
export const fonts = [];
