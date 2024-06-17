const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, `${process.env.NODE_ENV}.env`),
});

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  ORIGIN_URL: process.env.ORIGIN_URL || "http://localhost:3000",
  PORT: process.env.PORT || 3001,
};
