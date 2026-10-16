// ============================================================
// 01 - Descriptive statistics of the predicted soil attribute maps
// ============================================================
//
// Author: Merilyn T. A. Amorim
//
// Part of the spatial soil health assessment workflow for the Czech
// Republic, developed on the basis of the methodologies of:
//
//   Poppiel, R.R., Cherubin, M.R., Novais, J.J.M. et al. (2025).
//   Soil health in Latin America and the Caribbean.
//   Communications Earth & Environment, 6, 141.
//   https://doi.org/10.1038/s43247-025-02021-w
//
//   Greschuk, L.T., Dematte, J.A.M., Silvero, N.E.Q. et al. (2023).
//   A soil productivity system reveals most Brazilian agricultural
//   lands are below their maximum potential.
//   Scientific Reports, 13, 14103.
//   https://doi.org/10.1038/s41598-023-39981-y
//
// Environment: Google Earth Engine Code Editor (JavaScript API).
//
// Purpose:
//   Computes descriptive statistics (mean, standard deviation,
//   minimum, maximum, pixel count, and 5th, 25th, 50th, 75th and
//   95th percentiles) of eight soil attribute maps within the
//   Czech Republic boundary at 90 m resolution, and exports them to
//   Google Drive as a CSV table with one row per attribute.
//
// Inputs:
//   - Czech Republic boundary (FeatureCollection).
//   - Bootstrap-mean prediction maps (90 m) of total N, available P,
//     exchangeable K, pH (H2O), effective CEC, SOC and bulk density,
//     produced with notebooks/DSM_pipeline_ee_RC.ipynb and mosaicked
//     into single images with 00_mosaic_predicted_images.js.
//   - Earthworm abundance map from:
//     Phillips, H.R.P., Guerra, C.A., Bartz, M.L.C. et al. (2019).
//     Global distribution of earthworm diversity.
//     Science, 366(6464), 480-485.
//     https://doi.org/10.1126/science.aax4851
//
// Output (Google Drive, folder "RC_descriptive_statistics"):
//   RC_descriptive_statistics_organized.csv
//   Columns (fixed order): Attribute, Mean, SD, Min, Max, Count, P5,
//   P25, P50, P75, P95.
//
// Note: percentiles are estimated by Earth Engine from histograms of
// the pixel values and are therefore approximate.
// ============================================================

// Study area: Czech Republic boundary
var bbox = ee.FeatureCollection(
  "projects/ee-geocisworldspecs-203/assets/RC_Limits"
);


// ------------------------------------------------------------
// Load original maps
// ------------------------------------------------------------

var N_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_MacroN_g_kg_PredictedImages_90m"
);

var P_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_P_mgkg_PredictedImages_90m"
);

var K_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_K_mmolckg_PredictedImages_90m"
);

var pH_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_pH_H2O_PredictedImages_90m"
);

var CEC_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_CEC_Efe_mmolckg_PredictedImages_90m"
);

var SOC_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_SOC_gkg_PredictedImages_90m"
);

var BulkDensity_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_BD_kgdm3_PredictedImages_90m"
);

var Worms_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/Earthworms_Abundance"
).clip(bbox);


// ------------------------------------------------------------
// Selection of utilized bands
// ------------------------------------------------------------

var N = N_image
  .select("MacroN_g_kg_PredictedBootstrapMean")
  .rename("N");

var P = P_image
  .select("P_mgkg_PredictedBootstrapMean")
  .rename("P");

var K = K_image
  .select("K_mmolkg_PredictedBootstrapMean")
  .rename("K");

var pH = pH_image
  .select("pH_H2O_PredictedBootstrapMean")
  .rename("pH");

var CEC = CEC_image
  .select("CEC_Efe_mmolkg_PredictedBootstrapMean")
  .rename("CEC");

var SOC = SOC_image
  .select("C_gkg_PredictedBootstrapMean")
  .rename("SOC");

var BD = BulkDensity_image
  .select("Density_kgdm3_PredictedBootstrapMean")
  .rename("BD");

var Worms = Worms_image
  .select("b1")
  .rename("Worms");


// ------------------------------------------------------------
// Combine attributes into a multiband image
// ------------------------------------------------------------

var soil_attributes = N
  .addBands(P)
  .addBands(K)
  .addBands(pH)
  .addBands(CEC)
  .addBands(SOC)
  .addBands(BD)
  .addBands(Worms);


// ------------------------------------------------------------
// Descriptive statistics reducer
// ------------------------------------------------------------

var reducers = ee.Reducer.mean()
  .combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  })
  .combine({
    reducer2: ee.Reducer.min(),
    sharedInputs: true
  })
  .combine({
    reducer2: ee.Reducer.max(),
    sharedInputs: true
  })
  .combine({
    reducer2: ee.Reducer.count(),
    sharedInputs: true
  })
  .combine({
    reducer2: ee.Reducer.percentile([5, 25, 50, 75, 95]),
    sharedInputs: true
  });


// ------------------------------------------------------------
// Calculate statistics
// ------------------------------------------------------------

var statistics = soil_attributes.reduceRegion({
  reducer: reducers,
  geometry: bbox.geometry(),
  scale: 90,
  maxPixels: 1e13,
  bestEffort: true
});

print("Statistics:", statistics);


// ------------------------------------------------------------
// Create organized table
// One row = one attribute
// ------------------------------------------------------------

var attributes = [
  "N",
  "P",
  "K",
  "pH",
  "CEC",
  "SOC",
  "BD",
  "Worms"
];


// Function to extract statistics for each attribute
var createFeature = function(attribute) {

  attribute = ee.String(attribute);

  return ee.Feature(null, {
    
    Attribute: attribute,

    Mean: statistics.get(attribute.cat("_mean")),

    SD: statistics.get(attribute.cat("_stdDev")),

    Min: statistics.get(attribute.cat("_min")),

    Max: statistics.get(attribute.cat("_max")),

    Count: statistics.get(attribute.cat("_count")),

    P5: statistics.get(attribute.cat("_p5")),

    P25: statistics.get(attribute.cat("_p25")),

    P50: statistics.get(attribute.cat("_p50")),

    P75: statistics.get(attribute.cat("_p75")),

    P95: statistics.get(attribute.cat("_p95"))
    
  });
};


// Convert list to FeatureCollection
var statistics_table = ee.FeatureCollection(
  ee.List(attributes).map(createFeature)
);


print("Organized statistics table:", statistics_table);


// ------------------------------------------------------------
// Export table
// ------------------------------------------------------------

Export.table.toDrive({
  collection: statistics_table,
  description: "RC_descriptive_statistics_organized",
  folder: "RC_descriptive_statistics",
  fileNamePrefix: "RC_descriptive_statistics_organized",
  fileFormat: "CSV",
  // Fixed column order; excludes the system:index and .geo columns
  selectors: [
    "Attribute", "Mean", "SD", "Min", "Max", "Count",
    "P5", "P25", "P50", "P75", "P95"
  ]
});