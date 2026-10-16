// ============================================================
// 02 - Normalization of the soil indicators
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
//   Converts eight soil indicator maps into unitless scores (0-1)
//   using non-linear scoring functions, and exports the scored maps
//   as assets.
//
//   Scoring functions:
//
//   More is Better Index (MBI): N, P, K, CEC, SOC, earthworm abundance
//
//                        a
//     MBI = -----------------------------        for x < UL
//            1 + ((B - UL) / (x - UL))^S
//
//     MBI = a                                    for x >= UL
//
//   Less is Better Index (LBI): bulk density
//
//                        a
//     LBI = -----------------------------        for x > LL
//            1 + ((B - LL) / (x - LL))^S
//
//     LBI = a                                    for x <= LL
//
//   Optimal Midpoint Index (OMI): pH (H2O)
//
//           a / [1 + ((BL - O) / (x - O))^S]     for x < O
//     OMI = a                                    for x = O
//           a / [1 + ((BU - O) / (x - O))^S]     for x > O
//
//   where:
//     a      = maximum score (1 in this script)
//     S      = slope of the curve (-2.5)
//     B      = baseline value, with a score of 0.5 (median)
//     UL     = upper limit of the attribute values (score = 1)
//     LL     = lower limit of the attribute values (score = 1)
//     BL, BU = lower and upper baselines of the optimal midpoint
//              curve (score = 0.5)
//     O      = optimal value of the attribute (score = 1)
//     x      = value of the soil attribute
//
//   Values used in this study (computed within the Czech Republic
//   boundary at 90 m): B = 50th percentile; UL and BU = 95th
//   percentile; LL and BL = 5th percentile; O = 6.5 for pH.
//   Other limits (e.g., minimum/maximum, 2nd/98th percentiles) can be
//   used by changing LOWER_PERCENTILE and UPPER_PERCENTILE in the
//   USER SETTINGS section; the optimum is set by OPTIMUM_PH.
//
//   All scores are clamped to [0, 1]. The OMI requires BL < O < BU.
//
// Inputs:
//   - Czech Republic boundary (FeatureCollection).
//   - Bootstrap-mean prediction maps (90 m) produced with
//     notebooks/DSM_pipeline_ee_RC.ipynb and mosaicked with
//     00_mosaic_predicted_images.js.
//   - Earthworm abundance map (Phillips et al., 2019, Science 366,
//     480-485, https://doi.org/10.1126/science.aax4851).
//
// Outputs (Image assets, single band "constant", 90 m, EPSG:4326,
// clipped to the Czech Republic boundary):
//   RC_MacroN_g_kg_MBI_90m, RC_P_mgkg_MBI_90m, RC_K_mmolckg_MBI_90m,
//   RC_pH_H2O_OMI_90m, RC_CEC_mmolckg_MBI_90m, RC_SOC_gkg_MBI_90m,
//   RC_Worms_MBI_90m, RC_BD_kgdm_LBI_90m
//   These assets are the inputs of 03_functions_and_shi.js.
//
// Note: percentiles are estimated by Earth Engine from histograms and
// are therefore approximate. With the default settings (5, 50, 95),
// they match the P5, P50 and P95 values reported by
// 01_zonal_statistics.js.
// ============================================================
// ------------------------------------------------------------
// USER SETTINGS: normalization limits
// ------------------------------------------------------------

// Percentile used as the lower limit (LL) and lower baseline (BL)
var LOWER_PERCENTILE = 5;    // this study: 5 (use 0 for the minimum)

// Percentile used as the upper limit (UL) and upper baseline (BU)
var UPPER_PERCENTILE = 95;   // this study: 95 (use 100 for the maximum)

// Optimal value (O) of pH (H2O) for the Optimal Midpoint Index
var OPTIMUM_PH = 6.5;        // this study: 6.5

// The baseline (B) is always the median (50th percentile)
if (!(LOWER_PERCENTILE < 50 && UPPER_PERCENTILE > 50)) {
  throw new Error("LOWER_PERCENTILE must be < 50 and UPPER_PERCENTILE must be > 50.");
}

// Study area: Czech Republic boundary
var bbox = ee.FeatureCollection(
  "projects/ee-geocisworldspecs-203/assets/RC_Limits"
);

// ------------------------------------------------------------
// Load the original maps
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
var BD_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_BD_kgdm3_PredictedImages_90m"
);

// Earthworm abundance map
var Worms_image = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/Earthworms_Abundance"
).clip(bbox);

// ------------------------------------------------------------
// Band selection
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
var BD = BD_image
  .select("Density_kgdm3_PredictedBootstrapMean")
  .rename("BD");
// The original earthworm map contains a single band
var Worms = Worms_image
  .select(0)
  .rename("Worms");

// ------------------------------------------------------------
// Normalization functions
// ------------------------------------------------------------

// More is Better Index - MBI
// B (median) = 0.5
// UL (upper limit) = 1
function calculate_MBI(pixel, median, upperLimit) {
  // Prevents the equation from being evaluated for x >= UL
  var safePixel = pixel.where(
    pixel.gte(upperLimit),
    ee.Image.constant(median)
  );
  var MBI = ee.Image(1).divide(
    ee.Image(1).add(
      ee.Image(median)
        .subtract(upperLimit)
        .divide(safePixel.subtract(upperLimit))
        .pow(-2.5)
    )
  );
  // Upper-end treatment
  MBI = MBI.where(
    pixel.gte(upperLimit),
    1
  );
  return MBI.clamp(0, 1);
}

// Less is Better Index - LBI
// B (median) = 0.5
// LL (lower limit) = 1
function calculate_LBI(pixel, median, lowerLimit) {
  // Prevents the equation from being evaluated for x <= LL
  var safePixel = pixel.where(
    pixel.lte(lowerLimit),
    ee.Image.constant(median)
  );
  var LBI = ee.Image(1).divide(
    ee.Image(1).add(
      ee.Image(median)
        .subtract(lowerLimit)
        .divide(safePixel.subtract(lowerLimit))
        .pow(-2.5)
    )
  );
  // Lower-end treatment
  LBI = LBI.where(
    pixel.lte(lowerLimit),
    1
  );
  return LBI.clamp(0, 1);
}

// Optimal Midpoint Index - OMI
//
// BL (lower baseline) = 0.5
// O (optimum)         = 1
// BU (upper baseline) = 0.5
function calculate_OMI(
  pixel,
  lowerLimit,
  optimumPoint,
  upperLimit
) {
  // Branch below the optimum point
  var lowerPixel = pixel.where(
    pixel.gte(optimumPoint),
    ee.Image.constant(lowerLimit)
  );
  var OMI_lower = ee.Image(1).divide(
    ee.Image(1).add(
      ee.Image(lowerLimit)
        .subtract(optimumPoint)
        .divide(lowerPixel.subtract(optimumPoint))
        .pow(-2.5)
    )
  );

  // Branch above the optimum point
  var upperPixel = pixel.where(
    pixel.lte(optimumPoint),
    ee.Image.constant(upperLimit)
  );
  var OMI_upper = ee.Image(1).divide(
    ee.Image(1).add(
      ee.Image(upperLimit)
        .subtract(optimumPoint)
        .divide(upperPixel.subtract(optimumPoint))
        .pow(-2.5)
    )
  );

  // Combine both branches
  var OMI = OMI_lower.where(
    pixel.gt(optimumPoint),
    OMI_upper
  );

  // At the optimum point, score = 1
  OMI = OMI.where(
    pixel.eq(optimumPoint),
    1
  );

  return OMI.clamp(0, 1);
}

// ------------------------------------------------------------
// Calculate the lower limit, median and upper limit
// (output properties: <band>_lower, <band>_median, <band>_upper)
// ------------------------------------------------------------
function calculate_percentiles(image) {
  return image.reduceRegion({
    reducer: ee.Reducer.percentile(
      [LOWER_PERCENTILE, 50, UPPER_PERCENTILE],
      ["lower", "median", "upper"]
    ),
    geometry: bbox.geometry(),
    scale: 90,
    maxPixels: 10000000000000,
    tileScale: 4
  });
}

var N_stats = calculate_percentiles(N);
var P_stats = calculate_percentiles(P);
var K_stats = calculate_percentiles(K);
var pH_stats = calculate_percentiles(pH);
var CEC_stats = calculate_percentiles(CEC);
var SOC_stats = calculate_percentiles(SOC);
var Worms_stats = calculate_percentiles(Worms);
var BD_stats = calculate_percentiles(BD);

// Check values in the Console
print("N", N_stats);
print("P", P_stats);
print("K", K_stats);
print("pH", pH_stats);
print("CEC", CEC_stats);
print("SOC", SOC_stats);
print("Worms", Worms_stats);
print("BD", BD_stats);

// ------------------------------------------------------------
// Calculate the normalized maps
// ------------------------------------------------------------

// MBI
var N_MBI = calculate_MBI(
  N,
  ee.Number(N_stats.get("N_median")),
  ee.Number(N_stats.get("N_upper"))
);

var P_MBI = calculate_MBI(
  P,
  ee.Number(P_stats.get("P_median")),
  ee.Number(P_stats.get("P_upper"))
);

var K_MBI = calculate_MBI(
  K,
  ee.Number(K_stats.get("K_median")),
  ee.Number(K_stats.get("K_upper"))
);

var CEC_MBI = calculate_MBI(
  CEC,
  ee.Number(CEC_stats.get("CEC_median")),
  ee.Number(CEC_stats.get("CEC_upper"))
);

var SOC_MBI = calculate_MBI(
  SOC,
  ee.Number(SOC_stats.get("SOC_median")),
  ee.Number(SOC_stats.get("SOC_upper"))
);

var Worms_MBI = calculate_MBI(
  Worms,
  ee.Number(Worms_stats.get("Worms_median")),
  ee.Number(Worms_stats.get("Worms_upper"))
);

// LBI
var BD_LBI = calculate_LBI(
  BD,
  ee.Number(BD_stats.get("BD_median")),
  ee.Number(BD_stats.get("BD_lower"))
);

// OMI
var optimum_pH = OPTIMUM_PH;
var pH_OMI = calculate_OMI(
  pH,
  ee.Number(pH_stats.get("pH_lower")),
  optimum_pH,
  ee.Number(pH_stats.get("pH_upper"))
);

// ------------------------------------------------------------
// Rename the final band as constant
// Maintains the same format as the final assets
// ------------------------------------------------------------
N_MBI = N_MBI.rename("constant");
P_MBI = P_MBI.rename("constant");
K_MBI = K_MBI.rename("constant");
pH_OMI = pH_OMI.rename("constant");
CEC_MBI = CEC_MBI.rename("constant");
SOC_MBI = SOC_MBI.rename("constant");
Worms_MBI = Worms_MBI.rename("constant");
BD_LBI = BD_LBI.rename("constant");

// ------------------------------------------------------------
// Visualization
// ------------------------------------------------------------
Map.addLayer(N_MBI, {min: 0, max: 1}, "N_MBI");
Map.addLayer(P_MBI, {min: 0, max: 1}, "P_MBI");
Map.addLayer(K_MBI, {min: 0, max: 1}, "K_MBI");
Map.addLayer(pH_OMI, {min: 0, max: 1}, "pH_OMI");
Map.addLayer(CEC_MBI, {min: 0, max: 1}, "CEC_MBI");
Map.addLayer(SOC_MBI, {min: 0, max: 1}, "SOC_MBI");
Map.addLayer(Worms_MBI, {min: 0, max: 1}, "Worms_MBI");
Map.addLayer(BD_LBI, {min: 0, max: 1}, "BD_LBI");

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
var maxPixels = 1e13;
var scale = 90;
var region = bbox.geometry().bounds();
function exportImage(image, name) {
  Export.image.toAsset({
    image: image.clip(bbox).toFloat(),
    description: name,
    assetId: "projects/ee-geocisworldspecs-203/assets/" + name,
    region: region,
    crs: "EPSG:4326",
    scale: scale,
    maxPixels: maxPixels
  });
}
exportImage(N_MBI,     "RC_MacroN_g_kg_MBI_90m");
exportImage(P_MBI,     "RC_P_mgkg_MBI_90m");
exportImage(K_MBI,     "RC_K_mmolckg_MBI_90m");
exportImage(pH_OMI,    "RC_pH_H2O_OMI_90m");
exportImage(CEC_MBI,   "RC_CEC_mmolckg_MBI_90m");
exportImage(SOC_MBI,   "RC_SOC_gkg_MBI_90m");
exportImage(Worms_MBI, "RC_Worms_MBI_90m");
exportImage(BD_LBI,    "RC_BD_kgdm_LBI_90m");