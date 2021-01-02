export async function fetch(...args) {
  const res = await window.fetch(...args);
  return await res.json();
}
