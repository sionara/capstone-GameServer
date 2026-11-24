// PostgreSQL pool (Aiven). A pool rather than a single client because this
// server is a long-running process - one dropped/idle-timed-out connection
// would otherwise silently break every win/loss write until a restart.
const { Pool } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

// Matches config.js's convention: NODE_ENV-specific env file (development.env
// / production.env) in the server/ directory, not a plain .env.
dotenv.config({
  path: path.resolve(__dirname, "..", `${process.env.NODE_ENV}.env`),
});

// Aiven signs server certificates with a per-project CA. With DB_CA_CERT set
// (Aiven console -> service -> "CA certificate") the connection is fully
// verified; otherwise it's encrypted without verification, like Aiven's
// sslmode=require. DB_SSL=false disables TLS for a local Postgres.
function sslConfig() {
  if (process.env.DB_SSL === "false") return false;
  if (process.env.DB_CA_CERT) {
    return { ca: process.env.DB_CA_CERT.replace(/\\n/g, "\n") };
  }
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB,
  ssl: sslConfig(),
  max: 5,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

module.exports = pool;
