

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.BFsUyl7z.js","_app/immutable/chunks/BY5Bqgln.js","_app/immutable/chunks/BVnhoIqq.js"];
export const stylesheets = ["_app/immutable/assets/0.DqvO9aJ9.css"];
export const fonts = [];
