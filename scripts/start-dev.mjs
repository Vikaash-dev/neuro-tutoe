const requestedPort = process.argv[2] || process.env.PORT || "5174";

process.env.PORT = requestedPort;

await import("../server.js");
