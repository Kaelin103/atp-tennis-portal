import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Player } from "../models/Player.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TTL_MS = (parseInt(process.env.COUNTRY_INDEX_TTL_MINUTES, 10) || 10) * 60 * 1000;
let cache = null;
let cacheExpiry = 0;

function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .replace(/[\s'-]+/g, " ")
    .trim();
}

async function loadFromDb() {
  try {
    const docs = await Player.find({}, { firstName: 1, lastName: 1, countryCode: 1, fullName: 1 }).lean();
    const map = new Map();
    for (const p of docs) {
      const full = p.fullName || `${p.firstName || ""} ${p.lastName || ""}`.trim();
      const key = normalizeName(full);
      if (!key) continue;
      const code = (p.countryCode || "").toUpperCase();
      if (code) map.set(key, code);
    }
    return map;
  } catch (err) {
    console.warn("[countryIndex] loadFromDb failed:", err.message);
    return new Map();
  }
}

function loadFromCsv() {
  try {
    const candidatePaths = [
      path.resolve(__dirname, "../../../datasets/tennis_atp/atp_players.csv"), // project root/datasets
      path.resolve(__dirname, "../../datasets/tennis_atp/atp_players.csv"),    // backend/datasets (fallback)
      path.resolve(process.cwd(), "datasets/tennis_atp/atp_players.csv"),       // CWD/datasets
    ];
    const csvPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!csvPath) {
      console.warn("[countryIndex] CSV not found in candidates:", candidatePaths);
      return new Map();
    }
    const text = fs.readFileSync(csvPath, "utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return new Map();
    const header = lines[0].split(",").map((h) => h.trim());
    const idxFirst = header.findIndex((h) => /name_first/i.test(h));
    const idxLast = header.findIndex((h) => /name_last/i.test(h));
    const idxIoc = header.findIndex((h) => /^ioc$/i.test(h));
    const idxCountry = header.findIndex((h) => /country/i.test(h));
    const map = new Map();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const first = (cols[idxFirst] || "").replace(/^"|"$/g, "");
      const last = (cols[idxLast] || "").replace(/^"|"$/g, "");
      const ioc = (cols[idxIoc] || "").replace(/^"|"$/g, "").toUpperCase();
      const country = idxCountry >= 0 ? (cols[idxCountry] || "").replace(/^"|"$/g, "").toUpperCase() : "";
      const full = `${first} ${last}`.trim();
      const key = normalizeName(full);
      if (!key) continue;
      const code = ioc || country || "";
      if (code && !map.has(key)) map.set(key, code);
    }
    // Log brief summary for visibility during development
    console.log(`[countryIndex] Loaded ${map.size} entries from CSV at: ${csvPath}`);
    return map;
  } catch (err) {
    console.warn("[countryIndex] loadFromCsv failed:", err.message);
    return new Map();
  }
}

export async function getCountryIndex() {
  if (cache && cacheExpiry > Date.now()) return cache;
  const dbMap = await loadFromDb();
  const csvMap = loadFromCsv();
  // merge: DB wins
  const merged = new Map(csvMap);
  for (const [k, v] of dbMap.entries()) merged.set(k, v);
  cache = merged;
  cacheExpiry = Date.now() + TTL_MS;
  return cache;
}

export function resetCountryIndexCache() {
  cache = null;
  cacheExpiry = 0;
}