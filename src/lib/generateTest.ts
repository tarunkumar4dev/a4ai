export const generateTest = async (params) => {
  const res = await fetch("https://dcmnzvjftmdbywrjkust.supabase.co/functions/v1/generate-test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY // only if function requires auth
    },
    body: JSON.stringify(params)
  });

  const data = await res.json();
  return data;
};
