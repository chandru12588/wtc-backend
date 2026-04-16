import axios from "axios";
import KodaikanalTravelAgent from "../models/KodaikanalTravelAgent.js";

const SUPPORTED_CITIES = ["Chennai", "Bengaluru", "Trichy", "Dindigul", "Kodaikanal"];
const KNOWN_DESTINATIONS = {
  "Tamil Nadu": [
    "Kodaikanal",
    "Ooty",
    "Coonoor",
    "Kotagiri",
    "Yercaud",
    "Yelagiri",
    "Kolli Hills",
    "Valparai",
    "Topslip",
    "Megamalai",
    "Manjolai",
    "Kurangani",
    "Courtallam",
    "Kanyakumari",
    "Madurai",
    "Rameswaram",
    "Mahabalipuram",
    "Dhanushkodi",
    "Velankanni",
    "Tharangambadi",
    "Nagapattinam",
    "Poompuhar",
    "Thoothukudi",
    "Muttom",
    "Kovalam Beach Tamil Nadu",
    "Marina Beach",
    "Elliot's Beach",
    "Besant Nagar Beach",
    "Sothavilai",
    "Vivekananda Rock",
    "Meenakshi Amman Temple",
    "Ramanathaswamy Temple",
    "Brihadeeswarar Temple",
    "Arunachaleswarar Temple",
    "Nataraja Temple Chidambaram",
    "Srirangam Temple",
    "Kanchipuram Temples",
    "Palani Temple",
    "Dindigul",
    "Trichy",
    "Thanjavur",
    "Tiruvannamalai",
    "Kanchipuram",
    "Chidambaram",
  ],
  Kerala: [
    "Munnar",
    "Wayanad",
    "Vagamon",
    "Ponmudi",
    "Nelliyampathy",
    "Idukki",
    "Gavi",
    "Thekkady",
    "Silent Valley",
    "Alleppey",
    "Kochi",
    "Kovalam",
    "Varkala",
    "Kumarakom",
    "Athirappilly",
    "Bekal",
    "Cherai",
    "Muzhappilangad",
    "Marari",
    "Poovar",
    "Kappad",
    "Fort Kochi",
    "Kollam",
    "Ashtamudi",
    "Guruvayur Temple",
    "Sabarimala",
    "Padmanabhaswamy Temple",
    "Attukal Temple",
    "Chottanikkara Temple",
    "Vadakkunnathan Temple",
    "Kalpathy Temple",
    "Ambalappuzha Temple",
    "Thrissur",
    "Trivandrum",
    "Pathanamthitta",
    "Kottayam",
  ],
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeNumericString = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  // Convert decimal comma (e.g., 4,6) to decimal dot
  return text.replace(/(\d),(\d)/g, "$1.$2");
};

const numberFromUnknown = (value, fallback = Number.NaN) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const normalized = normalizeNumericString(value);
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (!match) return fallback;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const num = numberFromUnknown(item, Number.NaN);
      if (Number.isFinite(num)) return num;
    }
    return fallback;
  }
  if (value && typeof value === "object") {
    const preferredKeys = [
      "rating",
      "value",
      "text",
      "score",
      "stars",
      "average",
      "avg",
      "count",
    ];
    for (const key of preferredKeys) {
      const num = numberFromUnknown(value[key], Number.NaN);
      if (Number.isFinite(num)) return num;
    }
    for (const nested of Object.values(value)) {
      const num = numberFromUnknown(nested, Number.NaN);
      if (Number.isFinite(num)) return num;
    }
  }
  return fallback;
};

const toBooleanLike = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "yes", "y", "1", "verified", "active"].includes(normalized);
  }
  return false;
};

const hasVerifiedHintDeep = (input, depth = 0) => {
  if (depth > 3 || input == null) return false;
  if (toBooleanLike(input)) return true;

  if (typeof input === "string") {
    const text = input.toLowerCase();
    return text.includes("verified") || text.includes("google verified");
  }

  if (Array.isArray(input)) {
    return input.some((v) => hasVerifiedHintDeep(v, depth + 1));
  }

  if (typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (String(key).toLowerCase().includes("verified") && hasVerifiedHintDeep(value, depth + 1)) {
        return true;
      }
      if (hasVerifiedHintDeep(value, depth + 1)) return true;
    }
  }

  return false;
};

const extractFirstNumber = (value, fallback = 0) => {
  const parsed = numberFromUnknown(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickFirstNumber = (values = [], fallback = 0) => {
  for (const value of values) {
    const num = extractFirstNumber(value, Number.NaN);
    if (Number.isFinite(num)) return num;
  }
  return fallback;
};

const extractRatingFromRaw = (raw) => {
  const candidates = [];
  const seen = new Set();

  const walk = (node, depth = 0) => {
    if (depth > 5 || node == null) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }

    if (typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        const keyText = String(key || "").toLowerCase();
        const ratingLike =
          keyText.includes("rating") ||
          keyText.includes("stars") ||
          keyText.includes("star") ||
          keyText.includes("score");
        const noisy =
          keyText.includes("count") ||
          keyText.includes("total") ||
          keyText.includes("review") ||
          keyText.includes("vote") ||
          keyText.includes("user");

        if (ratingLike && !noisy) {
          const n = numberFromUnknown(value, Number.NaN);
          if (Number.isFinite(n) && n > 0 && n <= 5) {
            const k = n.toFixed(2);
            if (!seen.has(k)) {
              seen.add(k);
              candidates.push(n);
            }
          }
        }
        walk(value, depth + 1);
      }
      return;
    }

    const n = numberFromUnknown(node, Number.NaN);
    if (Number.isFinite(n) && n > 0 && n <= 5) {
      const k = n.toFixed(2);
      if (!seen.has(k)) {
        seen.add(k);
        candidates.push(n);
      }
    }
  };

  walk(raw, 0);
  if (!candidates.length) return 0;
  return Math.max(...candidates);
};

const toStringSafe = (value) => String(value || "").trim();

const toLowerSafe = (value) => toStringSafe(value).toLowerCase();

const normalizePhone = (value) => String(value || "").replace(/[^\d+]/g, "");

const detectVerified = (item) =>
  Boolean(
    toBooleanLike(item?.verified) ||
      toBooleanLike(item?.isVerified) ||
      toBooleanLike(item?.googleVerified) ||
      toBooleanLike(item?.is_verified) ||
      toBooleanLike(item?.profileVerified) ||
      toBooleanLike(item?.isGoogleVerified) ||
      toBooleanLike(item?.verificationStatus) ||
      toBooleanLike(item?.verification_status) ||
      toBooleanLike(item?.claimed) ||
      toBooleanLike(item?.isClaimed) ||
      toBooleanLike(item?.is_claimed) ||
      toBooleanLike(item?.badge) ||
      (Array.isArray(item?.badges) &&
        item.badges.some((badge) => String(badge || "").toLowerCase().includes("verified"))) ||
      hasVerifiedHintDeep(item)
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
      item?.google_rating,
      item?.aggregateRating,
      item?.aggregate_rating,
      item?.overallRating,
      item?.overall_rating,
      item?.ratingText,
      item?.rating_text,
      item?.ratingValue,
      item?.rating_value,
      item?.rawRating,
      item?.raw_rating,
    ],
    0
  );
  const inferredRating = ratingRaw > 0 ? ratingRaw : extractRatingFromRaw(item);
  const rating = Math.max(0, Math.min(5, inferredRating));

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
