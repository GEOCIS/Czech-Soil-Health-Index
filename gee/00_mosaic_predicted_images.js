// ============================================================
// 00 - Mosaic of the predicted soil attribute maps
// ============================================================
//
// Author: Merilyn T. A. Amorim
//
// Part of the spatial soil health assessment workflow for the Czech
// Republic (see README). Intermediate step between
// notebooks/DSM_pipeline_ee_RC.ipynb and 01_zonal_statistics.js.
//
// Environment: Google Earth Engine Code Editor (JavaScript API).
//
// Purpose:
//   DSM_pipeline_ee_RC.ipynb exports each predicted soil attribute
//   as an ImageCollection of tiles ("<classProperty>_PredictedImages").
//   This script mosaics the tiles into a single image with all bands,
//   at the original 90 m resolution, and exports it as an Image asset,
//   which reduces storage and simplifies the subsequent statistics,
//   normalization and Soil Health Index steps.
//
// Input:
//   - ImageCollection "<classProperty>_PredictedImages" created by the
//     notebook. Bands: <classProperty>_PredictedBootstrapMean (bootstrap
//     mean, the published prediction), <classProperty>_Predicted_lower
//     and <classProperty>_Predicted_upper (2.5th and 97.5th bootstrap
//     percentiles).
//   - Czech Republic boundary (export region = its bounding box).
//
// Output:
//   - Image asset with the same bands as the input collection
//     (e.g. "RC_SOC_gkg_PredictedImages_90m"). The output names used in
//     this study are listed in docs/data_requirements.md.
//
// Usage: edit "collection" and "outputAsset" in the USER SETTINGS,
// run the script and start the export task in the "Tasks" tab.
// Run once per soil attribute.
// ============================================================


// ------------------------------------------------------------
// USER SETTINGS
// ------------------------------------------------------------

var collection = ee.ImageCollection("projects/your-gee-cloud-project/assets/RC_C_gkg/C_gkg_PredictedImages");
var outputAsset = "projects/your-gee-cloud-project/assets/RC_SOC_gkg_PredictedImages_90m";
var region = ee.FeatureCollection("projects/ee-geocisworldspecs-203/assets/RC_Limits").geometry().bounds();

var projection = collection.first().projection().getInfo();
var image = collection.mosaic();

Export.image.toAsset({
  image: image,
  description: outputAsset.split("/").pop(),
  assetId: outputAsset,
  region: region,
  crs: projection.crs,
  crsTransform: projection.transform,
  maxPixels: 1e13
});