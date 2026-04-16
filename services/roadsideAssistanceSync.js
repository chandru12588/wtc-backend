import axios from "axios";
import RoadsideAssistance from "../models/RoadsideAssistance.js";

const buildSourceUrl = (datasetId, token) =>
  `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;

const syncRoadsideAssistance = async () => {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN environment variable is required");
  }
  const datasetId = "2lBgM8kyevUc5jYCs"; // Roadside Assistance dataset

  const sources = [
    { city: "Chennai", url: buildSourceUrl(datasetId, token) },
    { city: "Bengaluru", url: buildSourceUrl(datasetId, token) },
    { city: "Trichy", url: buildSourceUrl(datasetId, token) },
    { city: "Dindigul", url: buildSourceUrl(datasetId, token) },
    { city: "Kodaikanal", url: buildSourceUrl(datasetId, token) },
  ];

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const { city, url } of sources) {
    try {
      console.log(`Fetching roadside assistance data for ${city}...`);
      const response = await axios.get(url);
      const items = Array.isArray(response.data) ? response.data : [];

      console.log(`Processing ${items.length} items for ${city}...`);

      for (const item of items) {
        try {
          // Check if item already exists by name and city
          const existing = await RoadsideAssistance.findOne({
            name: item.name,
            city: city,
          });

          const assistanceData = {
            name: item.name || "Unknown Service",
            phone: item.phone || "",
            city: city,
            services: Array.isArray(item.services) ? item.services : [],
            rating: item.rating || 0,
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
          console.error(`Error processing item ${item.name}:`, itemError);
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
    message: `Synced ${totalProcessed} roadside assistance providers (${totalCreated} new, ${totalUpdated} updated)`,
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