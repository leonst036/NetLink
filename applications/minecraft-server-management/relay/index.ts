const port = parseInt(Deno.env.get("PORT") || "8000");

Deno.serve({ port }, (_req) => {
  return new Response(
    JSON.stringify({
      message: "Hello World from Minecraft Server Management relay!",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
