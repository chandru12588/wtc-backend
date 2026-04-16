import axios from "axios";
import RoadsideAssistance from "../models/RoadsideAssistance.js";

const buildSourceUrl = (datasetId, token) =>
  `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&token=${token}`;

const ALLOWED_CITIES = ["Chennai", "Bengaluru", "Trichy", "Dindigul", "Kodaikanal"];

const toStringSafe = (value) => String(value || "").trim();

const normalizePhone = (value) => toStringSafe(value).replace(/[^\d+]/g, "");

const numberFromUnknown = (value, fallback = Number.NaN) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const normalized = value.replace(/(\d),(\d)/g, "$1.$2");
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (!match) return fallback;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = numberFromUnknown(item, Number.NaN);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      const parsed = numberFromUnknown(nested, Number.NaN);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
};

const pickFirstString = (values = []) => {
  for (const value of values) {
    const text = toStringSafe(value);
    if (text) return text;
  }
  return "";
};

const detectName = (item) =>
  pickFirstString([
    item?.name,
    item?.title,
    item?.businessName,
    item?.serviceName,
    item?.providerName,
    item?.companyName,
    item?.shopName,
  ]);

const detectPhone = (item) => {
  const value = pickFirstString([
    item?.phone,
    item?.phoneNumber,
    item?.mobile,
    item?.contact,
    item?.contactNumber,
    item?.telephone,
    item?.whatsapp,
    item?.whatsappNumber,
  ]);
  return normalizePhone(value);
};

const detectServices = (item) => {
  if (Array.isArray(item?.services)) {
    return item.services.map((service) => toStringSafe(service)).filter(Boolean);
  }
  if (Array.isArray(item?.serviceTypes)) {
    return item.serviceTypes.map((service) => toStringSafe(service)).filter(Boolean);
  }

  const combined = pickFirstString([
    item?.servicesOffered,
    item?.service,
    item?.category,
    item?.categories,
    item?.type,
  ]);
  if (!combined) return [];

  return combined
    .split(/[,|/]/)
    .map((service) => toStringSafe(service))
    .filter(Boolean)
    .slice(0, 12);
};

const detectRating = (item) => {
  const rawRating = numberFromUnknown(
    item?.rating ??
      item?.stars ??
      item?.avgRating ??
      item?.averageRating ??
      item?.googleRating ??
      item?.score ??
      item?.totalScore,
    0
  );
  if (!Number.isFinite(rawRating)) return 0;
  return Math.max(0, Math.min(5, rawRating));
};

const detectCityFromItem = (item) => {
  const haystack = [
    item?.city,
    item?.locality,
    item?.address,
    item?.location,
    item?.title,
    item?.name,
  ]
    .map((value) => toStringSafe(value).toLowerCase())
    .join(" | ");

  const match = ALLOWED_CITIES.find((city) => haystack.includes(city.toLowerCase()));
  return match || "";
};

const getSources = (token) => {
  const fallbackDatasetId =
    process.env.APIFY_ROADSIDE_DATASET_ID || "2lBgM8kyevUc5jYCs";
  return [
    {
      city: "Chennai",
      url: buildSourceUrl(
        process.env.APIFY_ROADSIDE_CHENNAI_DATASET_ID || fallbackDatasetId,
        token
      ),
    },
    {
      city: "Bengaluru",
      url: buildSourceUrl(
        process.env.APIFY_ROADSIDE_BENGALURU_DATASET_ID || fallbackDatasetId,
        token
      ),
    },
    {
      city: "Trichy",
      url: buildSourceUrl(
        process.env.APIFY_ROADSIDE_TRICHY_DATASET_ID || fallbackDatasetId,
        token
      ),
    },
    {
      city: "Dindigul",
      url: buildSourceUrl(
        process.env.APIFY_ROADSIDE_DINDIGUL_DATASET_ID || fallbackDatasetId,
        token
      ),
    },
    {
      city: "Kodaikanal",
      url: buildSourceUrl(
        process.env.APIFY_ROADSIDE_KODAIKANAL_DATASET_ID || fallbackDatasetId,
        token
      ),
    },
  ];
};

const syncRoadsideAssistance = async () => {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN environment variable is required");
  }
  const sources = getSources(token);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { city, url } of sources) {
    try {
      console.log(`Fetching roadside assistance data for ${city}...`);
      const response = await axios.get(url, { timeout: 30000 });
      const items = Array.isArray(response.data) ? response.data : [];

      console.log(`Processing ${items.length} items for ${city}...`);

      for (const item of items) {
        try {
          const detectedCity = detectCityFromItem(item);
          const resolvedCity = detectedCity || city;
          if (!ALLOWED_CITIES.includes(resolvedCity)) {
            totalSkipped++;
            continue;
          }

          const name = detectName(item);
          const phone = detectPhone(item);
          if (!name || !phone) {
            totalSkipped++;
            continue;
          }

          const existing = await RoadsideAssistance.findOne(
            phone ? { city: resolvedCity, phone } : { city: resolvedCity, name }
          );

          const assistanceData = {
            name,
            phone,
            city: resolvedCity,
            services: detectServices(item),
            rating: detectRating(item),
            isActive: true,
            raw: item,
          };

          if (existing) {
            await RoadsideAssistance.findByIdAndUpdate(existing._id, assistanceData);
            totalUpdated++;
          } else {
            await RoadsideAssistance.create(assistanceData);
            totalCreated++;
          }
          totalProcessed++;
        } catch (itemError) {
          totalSkipped++;
          console.error(`Error processing item ${item?.name || item?.title || "unknown"}:`, itemError);
        }
      }
    } catch (cityError) {
      console.error(`Error fetching data for ${city}:`, cityError);
    }
  }

  return {
    totalProcessed,
    totalCreated,
    totalUpdated,
    totalSkipped,
    message: `Synced ${totalProcessed} roadside assistance providers (${totalCreated} new, ${totalUpdated} updated, ${totalSkipped} skipped)`,
  };
};

const startRoadsideAssistanceSyncScheduler = () => {
  // Sync every 24 hours
  setInterval(async () => {
    try {
      console.log("Starting scheduled roadside assistance sync...");
      const result = await syncRoadsideAssistance();
      console.log("Roadside assistance sync completed:", result);
    } catch (error) {
      console.error("Scheduled roadside assistance sync failed:", error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Initial sync
  setTimeout(async () => {
    try {
      console.log("Starting initial roadside assistance sync...");
      const result = await syncRoadsideAssistance();
      console.log("Initial roadside assistance sync completed:", result);
    } catch (error) {
      console.error("Initial roadside assistance sync failed:", error);
    }
  }, 5000); // 5 seconds after startup
};

export { syncRoadsideAssistance, startRoadsideAssistanceSyncScheduler };
