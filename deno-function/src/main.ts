export default async function (req: Request): Promise<Response> {
  const maintenance = Deno.env.get("MAINTENANCE_MODE") === "true";
  const message = Deno.env.get("message") || (maintenance ? "Classcastle is under maintenance" : "Classcastle is operational");
  
  const data = {
    maintenance,
    message,
    timestamp: new Date().toISOString()
  };

  return {
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    statusCode: 200
  };
}
