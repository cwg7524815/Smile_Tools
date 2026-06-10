"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const port = Number(process.env.PORT || 8001);
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const statsPath = path.join(dataDir, "support-stats.json");
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "https://cwg7524815.github.io,http://127.0.0.1:4173,http://localhost:4173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

function ensureStats() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(statsPath)) {
    fs.writeFileSync(statsPath, JSON.stringify({ applause: 0, money: 0, daily: {} }, null, 2));
  }
}

function readStats() {
  ensureStats();
  try {
    const stats = JSON.parse(fs.readFileSync(statsPath, "utf8"));
    return {
      applause: Number(stats.applause) || 0,
      money: Number(stats.money) || 0,
      daily: stats.daily && typeof stats.daily === "object" ? stats.daily : {},
    };
  } catch {
    return { applause: 0, money: 0, daily: {} };
  }
}

function writeStats(stats) {
  ensureStats();
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}

function publicStats(stats) {
  return {
    applause: Number(stats.applause) || 0,
    money: Number(stats.money) || 0,
  };
}

function sendJson(res, status, body, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function sendOptions(req, res) {
  const origin = req.headers.origin;
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  res.writeHead(204, headers);
  res.end();
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = forwarded || req.socket.remoteAddress || "unknown";
  return raw.replace(/^::ffff:/, "");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function increment(kind, req) {
  const stats = readStats();
  const day = todayKey();
  const ip = clientIp(req);
  stats.daily ||= {};
  stats.daily[day] ||= {};
  stats.daily[day][kind] ||= {};
  if (stats.daily[day][kind][ip]) {
    return { ...publicStats(stats), counted: false };
  }
  stats.daily[day][kind][ip] = true;
  stats[kind] += 1;
  pruneDaily(stats.daily, day);
  writeStats(stats);
  return { ...publicStats(stats), counted: true };
}

function pruneDaily(daily, keepDay) {
  for (const day of Object.keys(daily)) {
    if (day !== keepDay) delete daily[day];
  }
}

http
  .createServer((req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      sendOptions(req, res);
      return;
    }

    if (url.pathname === "/api/support/stats" && req.method === "GET") {
      sendJson(res, 200, publicStats(readStats()), origin);
      return;
    }

    if (url.pathname === "/api/support/applause" && req.method === "POST") {
      sendJson(res, 200, increment("applause", req), origin);
      return;
    }

    if (url.pathname === "/api/support/money" && req.method === "POST") {
      sendJson(res, 200, increment("money", req), origin);
      return;
    }

    if (url.pathname === "/health") {
      sendJson(res, 200, { ok: true }, origin);
      return;
    }

    sendJson(res, 404, { error: "Not found" }, origin);
  })
  .listen(port, "0.0.0.0", () => {
    ensureStats();
    console.log(`Smile support API listening on ${port}`);
  });
