export async function fetch(...args) {
  const res = await window.fetch(...args);
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  return res.json();
}
