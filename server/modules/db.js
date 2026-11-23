// Pooled (not single-connection) because, unlike APIServer's short-lived
// serverless invocations, this server is a long-running process - a single
// dropped/idle-timed-out connection here would otherwise silently break every
// win/loss write until the process is restarted.
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const path = require("path");

// Matches config.js's convention: NODE_ENV-specific env file (development.env
// / production.env) in the server/ directory, not a plain .env.
dotenv.config({
  path: path.resolve(__dirname, "..", `${process.env.NODE_ENV}.env`),
});

// TiDB Cloud's certificate is publicly trusted, so real TLS verification
// works here (unlike a self-signed host, which would need rejectUnauthorized:
// false - see connect.js in APIServer for the same reasoning).
const useSsl = process.env.DB_SSL !== "false";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  port: process.env.DB_PORT,
  database: process.env.DB,
  ssl: useSsl ? { minVersion: "TLSv1.2" } : undefined,
  waitForConnections: true,
  connectionLimit: 5,
});

module.exports = pool;
