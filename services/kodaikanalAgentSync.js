import axios from "axios";
import KodaikanalTravelAgent from "../models/KodaikanalTravelAgent.js";

const SUPPORTED_CITIES = ["Chennai", "Bengaluru", "Trichy", "Dindigul", "Kodaikanal"];
const KNOWN_DESTINATIONS = {
  "Tamil Nadu": [
    "Kodaikanal",
    "Ooty",
    "Yercaud",
    "Kanyakumari",
    "Madurai",
    "Rameswaram",
    "Coonoor",
    "Yelagiri",
    "Kolli Hills",
    "Chennai",
    "Mahabalipuram",
  ],
  Kerala: [
    "Munnar",
    "Wayanad",
    "Thekkady",
    "Alleppey",
    "Kochi",
    "Kovalam",
    "Varkala",
    "Kumarakom",
    "Athirappilly",
  ],
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractFirstNumber = (value, fallback = 0) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value !== "string") return fallback;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickFirstNumber = (values = [], fallback = 0) => {
  for (const value of values) {
    const num = extractFirstNumber(value, Number.NaN);
    if (Number.isFinite(num)) return num;
  }
  return fallback;
};

const toStringSafe = (value) => String(value || "").trim();

const toLowerSafe = (value) => toStringSafe(value).toLowerCase();

const normalizePhone = (value) => String(value || "").replace(/[^\d+]/g, "");

const detectVerified = (item) =>
  Boolean(
    item?.verified ||
      item?.isVerified ||
      item?.googleVerified ||
      item?.badge === "verified"
  );

const detectServices = (item) => {
  if (Array.isArray(item?.services)) {
    return item.services.map((s) => toStringSafe(s)).filter(Boolean);
  }
  if (Array.isArray(item?.serviceTypes)) {
    return item.serviceTypes.map((s) => toStringSafe(s)).filter(Boolean);
  }
  if (typeof item?.servicesOffered === "string") {
    return item.servicesOffered
      .split(",")
      .map((s) => toStringSafe(s))
      .filter(Boolean);
  }
  return [];
};

const detectDestinationAndState = (item) => {
  const haystack = [
    item?.destination,
    item?.place,
    item?.cityName,
    item?.location,
    item?.address,
    item?.title,
    item?.name,
    item?.description,
  ]
    .map((v) => toLowerSafe(v))
    .join(" | ");

  for (const [state, places] of Object.entries(KNOWN_DESTINATIONS)) {
    for (const place of places) {
      if (haystack.includes(place.toLowerCase())) {
        return { destination: place, destinationState: state };
      }
    }
  }

  return { destination: "Kodaikanal", destinationState: "Tamil Nadu" };
};

const buildSourceUrl = (datasetId, token) =>
  `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&token=${token}`;

const getSources = () => {
  const token = process.env.APIFY_TOKEN;
  if (!token) return [];

  const datasetChennai = process.env.APIFY_KODAI_CHENNAI_DATASET_ID || "GfffC8NwcC8htV1gv";
  const datasetBengaluru = process.env.APIFY_KODAI_BENGALURU_DATASET_ID || "UO7vu4CwcWREc85eR";
  const datasetTrichy = process.env.APIFY_KODAI_TRICHY_DATASET_ID || "zganzOeYm3EcpvpUb";
  const datasetDindigul = process.env.APIFY_KODAI_DINDIGUL_DATASET_ID || "gZTdK139ejzoVkQoq";
  const datasetKodaikanal = process.env.APIFY_KODAI_KODAIKANAL_DATASET_ID || "R4moyMIPaF79YNisp";

  return [
    { city: "Chennai", url: buildSourceUrl(datasetChennai, token) },
    { city: "Bengaluru", url: buildSourceUrl(datasetBengaluru, token) },
    { city: "Trichy", url: buildSourceUrl(datasetTrichy, token) },
    { city: "Dindigul", url: buildSourceUrl(datasetDindigul, token) },
    { city: "Kodaikanal", url: buildSourceUrl(datasetKodaikanal, token) },
  ];
};

const normalizeAgent = (item, city, sourceUrl) => {
  const name = toStringSafe(item?.name || item?.agencyName || item?.title || "Unknown Agent");
  const agencyName = toStringSafe(item?.agencyName || item?.companyName || "");
  const phone = normalizePhone(item?.phone || item?.mobile || item?.contact || "");
  const whatsapp = normalizePhone(item?.whatsapp || item?.whatsappNumber || "");
  const email = toLowerSafe(item?.email || item?.mail || "");
  const ratingRaw = pickFirstNumber(
    [
      item?.rating,
      item?.stars,
      item?.avgRating,
      item?.averageRating,
      item?.googleRating,
      item?.ratingText,
      item?.ratingValue,
      item?.rawRating,
    ],
    0
  );
  const rating = Math.max(0, Math.min(5, ratingRaw));

  const reviewRaw = pickFirstNumber(
    [
      item?.reviewCount,
      item?.reviews,
      item?.totalReviews,
      item?.ratingsCount,
      item?.reviewText,
      item?.userRatingsTotal,
    ],
    0
  );
  const reviewCount = Math.max(
    0,
    Math.floor(reviewRaw)
  );

  const priceFrom = Math.max(
    0,
    toNumber(
      item?.priceFrom ||
        item?.startingPrice ||
        item?.price ||
        item?.minPrice ||
        item?.packagePrice ||
        0,
      0
    )
  );

  const website = toStringSafe(item?.website || item?.site || item?.url || "");
  const address = toStringSafe(item?.address || item?.location || "");
  const description = toStringSafe(item?.description || item?.about || "");
  const services = detectServices(item);
  const verified = detectVerified(item);
  const apifyItemId = toStringSafe(item?.id || item?._id || item?.itemId || "");
  const { destination, destinationState } = detectDestinationAndState(item);

  const dedupeHint = phone || email || toLowerSafe(`${name}|${agencyName}`);
  const dedupeKey = `${city}|${dedupeHint}`;

  return {
    city,
    destination,
    destinationState,
    dedupeKey,
    apifyItemId,
    sourceUrl,
    name,
    agencyName,
    phone,
    whatsapp,
    email,
    website,
    address,
    rating,
    reviewCount,
    priceFrom,
    description,
    services,
    verified,
    isActive: true,
    lastSyncedAt: new Date(),
    raw: item || {},
  };
};

export const syncKodaikanalAgents = async () => {
  const sources = getSources();
  if (!sources.length) {
    return { synced: false, reason: "APIFY_TOKEN missing", upserted: 0, skipped: 0 };
  }

  const upsertOps = [];
  const seen = new Set();
  let skipped = 0;

  for (const source of sources) {
    if (!SUPPORTED_CITIES.includes(source.city)) continue;

    try {
      const response = await axios.get(source.url, { timeout: 30000 });
      const items = Array.isArray(response?.data) ? response.data : [];

      for (const item of items) {
        const normalized = normalizeAgent(item, source.city, source.url);
        if (!normalized.name || normalized.name === "Unknown Agent") {
          skipped += 1;
          continue;
        }
        if (seen.has(normalized.dedupeKey)) {
          skipped += 1;
          continue;
        }
        seen.add(normalized.dedupeKey);

        upsertOps.push({
          updateOne: {
            filter: { dedupeKey: normalized.dedupeKey },
            update: { $set: normalized },
            upsert: true,
          },
        });
      }
    } catch (error) {
      console.error(`KODAI SYNC ERROR (${source.city}):`, error?.message || error);
    }
  }

  let upserted = 0;
  if (upsertOps.length) {
    const result = await KodaikanalTravelAgent.bulkWrite(upsertOps, { ordered: false });
    upserted = (result?.upsertedCount || 0) + (result?.modifiedCount || 0);
  }

  return {
    synced: true,
    upserted,
    skipped,
    totalProcessed: upsertOps.length + skipped,
    syncedAt: new Date().toISOString(),
  };
};

export const startKodaikanalSyncScheduler = () => {
  const enabled = process.env.KODAI_SYNC_ENABLED !== "false";
  if (!enabled) return;

  const intervalHours = Math.max(1, Number(process.env.KODAI_SYNC_INTERVAL_HOURS || 6));
  const intervalMs = intervalHours * 60 * 60 * 1000;

  syncKodaikanalAgents()
    .then((summary) => {
      console.log("KODAI SYNC STARTUP:", summary);
    })
    .catch((error) => {
      console.error("KODAI SYNC STARTUP FAILED:", error?.message || error);
    });

  setInterval(async () => {
    try {
      const summary = await syncKodaikanalAgents();
      console.log("KODAI SYNC SCHEDULED:", summary);
    } catch (error) {
      console.error("KODAI SYNC SCHEDULED FAILED:", error?.message || error);
    }
  }, intervalMs);
};
