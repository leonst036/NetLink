const port = parseInt(Deno.env.get("PORT") || "8000");

Deno.serve({ port }, (_req) => {
  return new Response(
    JSON.stringify({
      message: "Hello World from Minecraft Server Management local server!",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
