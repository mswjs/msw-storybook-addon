export async function fetch(...args: any[]) {
  // @ts-expect-error TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
  const res = await window.fetch(...args);
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  return res.json();
}
